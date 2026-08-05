import OpenAI from "openai";

import { searchSourcePassages } from "@/app/materials/retrieval-actions";
import {
  TutorGenerationError,
  createMockTutorReply,
  generateOpenAiTutorReply,
  resolveTutorGenerationMode,
  type TutorSourcePassage,
} from "@/lib/tutor-generation";
import { hasPriorGroundedTutorReply } from "@/lib/tutor-history";
import { TutorRequestError, validateTutorMessageRequest } from "@/lib/tutor-request";
import { createTutorEventStream, type TutorStreamEvent } from "@/lib/tutor-stream";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class TutorRouteError extends Error {}

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && first.every((id) => second.includes(id));
}

function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 54 ? `${compact.slice(0, 51).trimEnd()}…` : compact;
}

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * A private, stateful tutor endpoint. It ignores any new document selection
 * once a conversation exists and uses only the saved selection after checking
 * that each document is still a ready document in the current user's course.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new TutorRouteError("Send a valid tutor request.");
    }

    let input: ReturnType<typeof validateTutorMessageRequest>;
    try {
      input = validateTutorMessageRequest(body);
    } catch (error) {
      throw new TutorRouteError(
        error instanceof TutorRequestError ? error.message : "Send a valid tutor request.",
      );
    }

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
      return errorResponse("Your session has expired. Please sign in again.", 401);
    }

    let conversation: {
      id: string;
      course_id: string;
      source_document_ids: unknown;
      title: string;
      created_at: string;
      updated_at: string;
    };
    let isNewConversation = false;

    if (input.conversationId) {
      const { data, error } = await supabase
        .from("tutor_conversations")
        .select("id, course_id, source_document_ids, title, created_at, updated_at")
        .eq("id", input.conversationId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (error || !data || data.course_id !== input.courseId) {
        throw new TutorRouteError("That tutor conversation is unavailable. Start a new one instead.");
      }
      conversation = data;
      const savedDocumentIds = Array.isArray(conversation.source_document_ids)
        ? conversation.source_document_ids.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))
        : [];
      if (!sameIds(savedDocumentIds, input.documentIds)) {
        throw new TutorRouteError("This conversation is locked to its original materials. Start a new conversation to change them.");
      }
    } else {
      const { data, error } = await supabase
        .from("tutor_conversations")
        .insert({
          owner_id: userId,
          course_id: input.courseId,
          source_document_ids: input.documentIds,
          title: titleFromMessage(input.message),
          topic_focus: input.message.slice(0, 240),
        })
        .select("id, course_id, source_document_ids, title, created_at, updated_at")
        .single();
      if (error || !data) throw new TutorRouteError("We could not start that conversation. Please try again.");
      conversation = data;
      isNewConversation = true;
    }

    // This protects against a stale, deleted, or maliciously edited saved scope.
    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id")
      .eq("course_id", input.courseId)
      .eq("owner_id", userId)
      .eq("status", "ready")
      .in("id", input.documentIds);
    if (documentsError || (documents ?? []).length !== input.documentIds.length) {
      throw new TutorRouteError("Every conversation material must still be ready and belong to this course.");
    }

    let generationMode: "mock" | "openai";
    try {
      generationMode = resolveTutorGenerationMode(
        process.env.AI_TUTOR_MODE ??
          (process.env.AI_EMBEDDINGS_MODE === "mock" ? "mock" : undefined),
        process.env.NODE_ENV,
      );
    } catch (error) {
      throw new TutorRouteError(
        error instanceof TutorGenerationError ? error.message : "Tutor generation is not configured.",
      );
    }
    if (generationMode === "openai" && !process.env.OPENAI_API_KEY) {
      throw new TutorRouteError("Tutor AI is not configured yet. Add the server-only OpenAI API key, then try again.");
    }

    const { error: userMessageError } = await supabase.from("tutor_messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: input.message,
      citations: [],
    });
    if (userMessageError) throw new TutorRouteError("We could not save your message. Please try again.");

    const [{ data: history, error: historyError }, sourceSearch] = await Promise.all([
      supabase
        .from("tutor_messages")
        .select("role, content, citations")
        .eq("conversation_id", conversation.id)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(8),
      searchSourcePassages({
        courseId: input.courseId,
        documentIds: input.documentIds,
        query: input.message,
      }),
    ]);
    if (historyError) throw new TutorRouteError("We could not reopen this conversation. Please try again.");
    if ("error" in sourceSearch) throw new TutorRouteError(sourceSearch.error);

    const recentMessages = (history ?? [])
      .filter((message): message is { role: "user" | "assistant"; content: string; citations: unknown } =>
        (message.role === "user" || message.role === "assistant") && typeof message.content === "string",
      )
      .reverse();
    const hasPriorAssistantReply = hasPriorGroundedTutorReply(recentMessages);
    const passages: TutorSourcePassage[] = sourceSearch.passages.map((passage) => ({
      id: passage.id,
      documentId: passage.documentId,
      documentTitle: passage.documentTitle,
      pageNumber: passage.pageNumber,
      heading: passage.heading,
      content: passage.content,
    }));

    const reply =
      generationMode === "mock"
        ? createMockTutorReply({
            question: input.message,
            passages,
            hasPriorAssistantReply,
            recentMessages,
          })
        : await generateOpenAiTutorReply(
            new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as Parameters<
              typeof generateOpenAiTutorReply
            >[0],
            {
              question: input.message,
              passages,
              hasPriorAssistantReply,
              recentMessages,
            },
            process.env.OPENAI_TUTOR_MODEL,
          );

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("tutor_messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: reply.content,
        citations: reply.citations,
      })
      .select("id, created_at")
      .single();
    if (assistantMessageError || !assistantMessage) {
      throw new TutorRouteError("We could not save the tutor response. Please try again.");
    }

    // The update also refreshes updated_at through the existing database trigger.
    const { data: updatedConversation } = await supabase
      .from("tutor_conversations")
      .update({ title: conversation.title })
      .eq("id", conversation.id)
      .select("updated_at")
      .maybeSingle();

    const events: TutorStreamEvent[] = [
      {
        type: "conversation",
        conversation: {
          id: conversation.id,
          courseId: input.courseId,
          sourceDocumentIds: input.documentIds,
          title: conversation.title,
          createdAt: conversation.created_at,
          updatedAt: updatedConversation?.updated_at ?? conversation.updated_at,
        },
      },
      {
        type: "assistant",
        messageId: assistantMessage.id,
        createdAt: assistantMessage.created_at,
        grounding: reply.grounding,
        citations: reply.citations,
        generationMode,
      },
      { type: "delta", value: reply.content },
      { type: "done" },
    ];

    return new Response(createTutorEventStream(events), {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Tutor-Conversation": isNewConversation ? "new" : "existing",
      },
    });
  } catch (error) {
    const message =
      error instanceof TutorRouteError || error instanceof TutorGenerationError
        ? error.message
        : "We could not prepare a tutor response. Please try again.";
    return errorResponse(message);
  }
}
