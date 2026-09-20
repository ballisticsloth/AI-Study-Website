"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import {
  AssessmentGenerationError,
  OPENAI_ASSESSMENT_MODEL,
  type AssessmentLevel,
  type AssessmentSourcePassage,
  type AssessmentType,
  createMockAssessment,
  generateOpenAiAssessment,
  resolveAssessmentGenerationMode,
} from "@/lib/assessment-generation";
import { getAiProviderErrorCode, getAiProviderErrorMessage } from "@/lib/ai-provider-errors";
import { completeAiUsage, reserveAiUsage } from "@/lib/ai-usage-server";
import { parseSavedAssessment, type SavedAssessment } from "@/lib/assessments";
import { createClient } from "@/lib/supabase/server";

type ActionError = { error: string };
type ActionResult<T> = T | ActionError;
type AuthenticatedClient =
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | ActionError;

export type GenerateAssessmentInput = {
  courseId: string;
  documentIds: string[];
  type: AssessmentType;
  topicFocus: string;
  questionCount: number;
  level: AssessmentLevel;
};

export type SaveAssessmentInput = {
  id: string;
  title: string;
  directions: string;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength) : "";
}

async function getAuthenticatedClient(): Promise<AuthenticatedClient> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !isUuid(userId)) {
    return { error: "Your session has expired. Please sign in again." };
  }

  return { supabase, userId };
}

function mapPassages(value: unknown): AssessmentSourcePassage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const passage = row as Record<string, unknown>;

    if (
      !isUuid(passage.id) ||
      !isUuid(passage.document_id) ||
      typeof passage.document_title !== "string" ||
      typeof passage.content !== "string"
    ) {
      return [];
    }

    return [{
      id: passage.id,
      documentId: passage.document_id,
      documentTitle: passage.document_title,
      pageNumber: typeof passage.page_number === "number" ? passage.page_number : null,
      heading: typeof passage.heading === "string" ? passage.heading : null,
      content: passage.content,
    }];
  });
}

async function fetchAssessment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentId: string,
): Promise<SavedAssessment | null> {
  const { data, error } = await supabase
    .from("generated_materials")
    .select(
      "id, course_id, type, title, directions, generation_settings, created_at, updated_at, material_questions(id, question_index, prompt, question_type, options, correct_answer, explanation, citations)",
    )
    .eq("id", assessmentId)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return parseSavedAssessment(data);
  } catch {
    return null;
  }
}

export async function generateAssessment(
  input: GenerateAssessmentInput,
): Promise<ActionResult<{ assessment: SavedAssessment; generationMode: "mock" | "openai" }>> {
  const authenticated = await getAuthenticatedClient();
  if ("error" in authenticated) return authenticated;

  if (
    !input ||
    !isUuid(input.courseId) ||
    !Array.isArray(input.documentIds) ||
    input.documentIds.length === 0 ||
    input.documentIds.length > 25 ||
    input.documentIds.some((id) => !isUuid(id))
  ) {
    return { error: "Choose a course and at least one ready source." };
  }

  const documentIds = [...new Set(input.documentIds)];
  const { data: course, error: courseError } = await authenticated.supabase
    .from("courses")
    .select("id")
    .eq("id", input.courseId)
    .eq("owner_id", authenticated.userId)
    .maybeSingle();

  if (courseError || !course) return { error: "That course is unavailable. Refresh and try again." };

  const { data: documents, error: documentsError } = await authenticated.supabase
    .from("documents")
    .select("id")
    .eq("course_id", input.courseId)
    .eq("status", "ready")
    .in("id", documentIds);

  if (documentsError || (documents ?? []).length !== documentIds.length) {
    return { error: "Choose only ready sources from the selected course." };
  }

  let generationMode: "mock" | "openai";
  try {
    generationMode = resolveAssessmentGenerationMode(
      process.env.AI_ASSESSMENT_MODE ??
        (process.env.AI_EMBEDDINGS_MODE === "mock" ? "mock" : undefined),
      process.env.NODE_ENV,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation is not configured." };
  }

  const topicFocus = cleanText(input.topicFocus, 240);
  let passages: AssessmentSourcePassage[] = [];

  if (topicFocus) {
    const { data, error } = await authenticated.supabase.rpc("match_document_chunks_by_text", {
      p_course_id: input.courseId,
      p_document_ids: documentIds,
      p_query: topicFocus,
      p_match_count: 6,
    });
    if (!error) passages = mapPassages(data);
  }

  if (passages.length === 0) {
    const { data, error } = await authenticated.supabase
      .from("document_chunks")
      .select("id, document_id, page_number, heading, content, documents!inner(title, course_id, status)")
      .in("document_id", documentIds)
      .limit(6);

    if (error || !data) return { error: "We could not retrieve those source passages. Please try again." };

    passages = (data as Array<Record<string, unknown>>).flatMap((row) => {
      const document = row.documents as Record<string, unknown> | null;
      if (!document || document.course_id !== input.courseId || document.status !== "ready") return [];
      return mapPassages([{ ...row, document_title: document.title }]);
    });
  }

  if (passages.length === 0) return { error: "No citation-ready passages were found in those sources." };

  const model =
    generationMode === "openai"
      ? process.env.OPENAI_ASSESSMENT_MODEL ?? OPENAI_ASSESSMENT_MODEL
      : "mock";
  const reservation = await reserveAiUsage(authenticated.supabase as never, {
    feature: "assessment_generation",
    model,
    generationMode,
  });
  if (!("usageEventId" in reservation)) return { error: reservation.error };

  let usageWasFinalized = false;

  try {
    const generationInput = { ...input, topicFocus, passages };
    const generated =
      generationMode === "mock"
        ? { draft: createMockAssessment(generationInput), usage: { inputTokens: 0, outputTokens: 0 } }
        : await generateOpenAiAssessment(
            new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as Parameters<
              typeof generateOpenAiAssessment
            >[0],
            generationInput,
            model,
          );
    const draft = generated.draft;

    await completeAiUsage({
      usageEventId: reservation.usageEventId,
      status: "completed",
      generationMode,
      usage: generated.usage,
    });
    usageWasFinalized = true;

    const { data: material, error: materialError } = await authenticated.supabase
      .from("generated_materials")
      .insert({
        owner_id: authenticated.userId,
        course_id: input.courseId,
        type: input.type,
        status: "generating",
        title: draft.title,
        directions: draft.directions,
        generation_settings: {
          topicFocus,
          level: input.level,
          questionCount: input.questionCount,
          documentIds,
          generationMode,
        },
      })
      .select("id")
      .single();

    if (materialError || !material) return { error: "We could not save this assessment draft. Please try again." };

    const { error: questionsError } = await authenticated.supabase.from("material_questions").insert(
      draft.questions.map((question, questionIndex) => ({
        material_id: material.id,
        question_index: questionIndex,
        prompt: question.prompt,
        question_type: question.questionType,
        options: question.options,
        correct_answer: question.correctAnswer,
        explanation: question.explanation,
        citations: question.citations,
      })),
    );

    if (questionsError) {
      await authenticated.supabase.from("generated_materials").delete().eq("id", material.id);
      return { error: "We could not save this assessment draft. Please try again." };
    }

    await authenticated.supabase.from("generated_materials").update({ status: "ready" }).eq("id", material.id);
    const assessment = await fetchAssessment(authenticated.supabase, material.id);
    if (!assessment) return { error: "The assessment was saved but could not be reopened. Refresh the page." };

    revalidatePath("/assessments");
    return { assessment, generationMode };
  } catch (error) {
    if (!usageWasFinalized) {
      await completeAiUsage({
        usageEventId: reservation.usageEventId,
        status: "failed",
        generationMode,
        providerErrorCode: getAiProviderErrorCode(error),
      });
    }

    return {
      error:
        getAiProviderErrorMessage(error) ??
        (error instanceof AssessmentGenerationError
          ? error.message
          : "We could not generate that assessment. Please try again."),
    };
  }
}

export async function saveAssessment(
  input: SaveAssessmentInput,
): Promise<ActionResult<{ assessment: SavedAssessment }>> {
  const authenticated = await getAuthenticatedClient();
  if ("error" in authenticated) return authenticated;
  if (!input || !isUuid(input.id) || !Array.isArray(input.questions)) {
    return { error: "That assessment could not be found." };
  }

  const assessment = await fetchAssessment(authenticated.supabase, input.id);
  if (!assessment || input.questions.length !== assessment.questions.length) {
    return { error: "That assessment could not be saved. Refresh and try again." };
  }

  const title = cleanText(input.title, 160);
  const directions = cleanText(input.directions, 1_000);
  if (!title || !directions) return { error: "Add a title and directions before saving." };

  const existingById = new Map(assessment.questions.map((question) => [question.id, question]));
  const updates = input.questions.map((question) => {
    const existing = existingById.get(question.id);
    const prompt = cleanText(question.prompt, 1_500);
    const correctAnswer = cleanText(question.correctAnswer, 1_000);
    const explanation = cleanText(question.explanation, 1_500);
    const options = Array.isArray(question.options)
      ? question.options.map((option) => cleanText(option, 600)).filter(Boolean)
      : [];

    if (!existing || !prompt || !correctAnswer || !explanation) throw new AssessmentGenerationError();
    if (existing.questionType === "multiple_choice" && (options.length !== 4 || !options.includes(correctAnswer))) {
      throw new AssessmentGenerationError("Each multiple-choice question needs four choices, including its answer.");
    }
    if (existing.questionType === "short_answer" && options.length > 0) throw new AssessmentGenerationError();
    return { id: question.id, prompt, correctAnswer, explanation, options };
  });

  try {
    const { error: materialError } = await authenticated.supabase
      .from("generated_materials")
      .update({ title, directions })
      .eq("id", input.id);
    if (materialError) return { error: "We could not save this assessment. Please try again." };

    for (const question of updates) {
      const { error } = await authenticated.supabase
        .from("material_questions")
        .update({
          prompt: question.prompt,
          options: question.options,
          correct_answer: question.correctAnswer,
          explanation: question.explanation,
        })
        .eq("id", question.id)
        .eq("material_id", input.id);
      if (error) throw error;
    }

    const saved = await fetchAssessment(authenticated.supabase, input.id);
    if (!saved) return { error: "The assessment was saved but could not be reopened. Refresh the page." };
    revalidatePath("/assessments");
    return { assessment: saved };
  } catch (error) {
    return {
      error:
        error instanceof AssessmentGenerationError
          ? error.message
          : "We could not save this assessment. Please try again.",
    };
  }
}

export async function deleteAssessment(assessmentId: string): Promise<ActionResult<Record<string, never>>> {
  const authenticated = await getAuthenticatedClient();
  if ("error" in authenticated) return authenticated;
  if (!isUuid(assessmentId)) return { error: "That assessment could not be found." };

  const { error } = await authenticated.supabase
    .from("generated_materials")
    .delete()
    .eq("id", assessmentId);

  if (error) return { error: "We could not delete that assessment. Please try again." };
  revalidatePath("/assessments");
  return {};
}
