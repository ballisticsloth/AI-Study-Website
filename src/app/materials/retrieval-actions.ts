"use server";

import "server-only";

import OpenAI from "openai";

import {
  createMockEmbeddings,
  EmbeddingGenerationError,
  generateEmbeddings,
  resolveEmbeddingMode,
  type EmbeddingMode,
} from "@/lib/embeddings";
import {
  prepareSourceSearch,
  SourceSearchInputError,
  validateSourceSearchInput,
  type SourceSearchInput,
} from "@/lib/source-retrieval";
import { createClient } from "@/lib/supabase/server";

export type SourcePassage = {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  heading: string | null;
  content: string;
  similarity: number;
};

type SourceSearchResult =
  | { passages: SourcePassage[]; embeddingMode: EmbeddingMode }
  | { error: string };

function mapSourcePassages(value: unknown): SourcePassage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const passage = row as Record<string, unknown>;

    if (
      typeof passage.id !== "string" ||
      typeof passage.document_id !== "string" ||
      typeof passage.document_title !== "string" ||
      typeof passage.content !== "string" ||
      typeof passage.similarity !== "number" ||
      !Number.isFinite(passage.similarity)
    ) {
      return [];
    }

    return [
      {
        id: passage.id,
        documentId: passage.document_id,
        documentTitle: passage.document_title,
        pageNumber: typeof passage.page_number === "number" ? passage.page_number : null,
        heading: typeof passage.heading === "string" ? passage.heading : null,
        content: passage.content,
        similarity: passage.similarity,
      },
    ];
  });
}

/**
 * Finds citation-ready source passages for the current user. The caller may
 * select a course and documents, but the signed-in user is always derived
 * from the server session and ownership is enforced again inside the SQL RPC.
 */
export async function searchSourcePassages(
  input: SourceSearchInput,
): Promise<SourceSearchResult> {
  let validatedInput: ReturnType<typeof validateSourceSearchInput>;

  try {
    validatedInput = validateSourceSearchInput(input);
  } catch (error) {
    return {
      error:
        error instanceof SourceSearchInputError
          ? error.message
          : "Choose a valid source search.",
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return { error: "Your session has expired. Please sign in again." };
  }

  // This check avoids embedding a query for a course the requester cannot
  // access. RLS and match_document_chunks repeat this constraint in depth.
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("id", validatedInput.courseId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (courseError || !course) {
    return { error: "That course is unavailable. Refresh the page and try again." };
  }

  let embeddingMode: EmbeddingMode;

  try {
    embeddingMode = resolveEmbeddingMode(
      process.env.AI_EMBEDDINGS_MODE,
      process.env.NODE_ENV,
    );
  } catch (error) {
    return {
      error:
        error instanceof EmbeddingGenerationError
          ? error.message
          : "AI source search is not configured correctly.",
    };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (embeddingMode === "openai" && !openAiApiKey) {
    return {
      error:
        "AI source search is not configured yet. Add the server-only OpenAI API key, then try again.",
    };
  }

  try {
    const [queryEmbedding] =
      embeddingMode === "mock"
        ? createMockEmbeddings([validatedInput.query])
        : await generateEmbeddings(new OpenAI({ apiKey: openAiApiKey }), [validatedInput.query]);
    const { rpcArguments } = prepareSourceSearch(validatedInput, queryEmbedding);
    const { data, error } = await supabase.rpc("match_document_chunks", rpcArguments);

    if (error) {
      return { error: "We could not search those sources. Please try again." };
    }

    return { passages: mapSourcePassages(data), embeddingMode };
  } catch (error) {
    return {
      error:
        error instanceof EmbeddingGenerationError
          ? error.message
          : "We could not search those sources. Please try again.",
    };
  }
}
