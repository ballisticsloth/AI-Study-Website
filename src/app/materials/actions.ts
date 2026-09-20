"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import {
  DocumentIngestionError,
  extractDocumentSource,
  userFacingIngestionError,
} from "@/lib/document-ingestion";
import {
  createMockEmbeddings,
  EmbeddingGenerationError,
  generateEmbeddings,
  resolveEmbeddingMode,
  type EmbeddingMode,
} from "@/lib/embeddings";
import {
  COURSE_MATERIALS_BUCKET,
  getSupportedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentExtension,
} from "@/lib/materials";
import {
  createAdminClient,
  isDocumentProcessingConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ActionError = { error: string };
type AuthenticatedSupabase =
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
    }
  | ActionError;

type CreateCourseResult =
  | { course: { id: string; title: string } }
  | ActionError;

type PrepareDocumentUploadInput = {
  courseId: string;
  title: string;
  originalFilename: string;
  byteSize: number;
  extension: SupportedDocumentExtension;
};

type PrepareDocumentUploadResult =
  | {
      document: {
        id: string;
        storagePath: string;
        mimeType: string;
      };
    }
  | ActionError;

type ProcessDocumentResult =
  | {
      processed: {
        sections: number;
        chunks: number;
        embeddingMode: EmbeddingMode;
      };
    }
  | ActionError;

type ClaimedDocument = {
  id: string;
  storage_path: string;
  mime_type: string;
  byte_size: number | string;
  processing_token: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isValidUuid(value: string) {
  return uuidPattern.test(value);
}

async function getAuthenticatedSupabase(): Promise<AuthenticatedSupabase> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string" || !isValidUuid(userId)) {
    return { error: "Your session has expired. Please sign in again." };
  }

  return { supabase, userId };
}

export async function createCourse(title: string): Promise<CreateCourseResult> {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated) {
    return { error: authenticated.error };
  }

  if (typeof title !== "string") {
    return { error: "Enter a course or workspace name." };
  }

  const cleanTitle = cleanText(title, 120);

  if (!cleanTitle) {
    return { error: "Enter a course or workspace name." };
  }

  const { data, error } = await authenticated.supabase
    .from("courses")
    .insert({ owner_id: authenticated.userId, title: cleanTitle })
    .select("id, title")
    .single();

  if (error || !data) {
    return { error: "We could not create that course. Please try again." };
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");

  return { course: { id: data.id, title: data.title } };
}

export async function prepareDocumentUpload(
  input: PrepareDocumentUploadInput,
): Promise<PrepareDocumentUploadResult> {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated) {
    return { error: authenticated.error };
  }

  if (
    !input ||
    typeof input.courseId !== "string" ||
    typeof input.title !== "string" ||
    typeof input.originalFilename !== "string" ||
    typeof input.extension !== "string" ||
    !Object.prototype.hasOwnProperty.call(SUPPORTED_DOCUMENT_TYPES, input.extension)
  ) {
    return { error: "Choose a supported file and give it a title." };
  }

  const title = cleanText(input.title, 255);
  const originalFilename = cleanText(input.originalFilename, 255);
  const fileType = SUPPORTED_DOCUMENT_TYPES[input.extension];
  const filenameType = getSupportedDocumentType(originalFilename);

  if (!isValidUuid(input.courseId)) {
    return { error: "Choose a valid course before uploading." };
  }

  if (!title || !originalFilename || !fileType || filenameType?.extension !== input.extension) {
    return { error: "Choose a supported file and give it a title." };
  }

  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > MAX_DOCUMENT_SIZE_BYTES
  ) {
    return { error: "Files must be between 1 byte and 10 MB." };
  }

  const { data: course, error: courseError } = await authenticated.supabase
    .from("courses")
    .select("id")
    .eq("id", input.courseId)
    .maybeSingle();

  if (courseError || !course) {
    return { error: "That course is unavailable. Refresh the page and try again." };
  }

  const documentId = randomUUID();
  const storagePath = `${authenticated.userId}/${documentId}/original.${input.extension}`;

  const { error: insertError } = await authenticated.supabase.from("documents").insert({
    id: documentId,
    course_id: input.courseId,
    owner_id: authenticated.userId,
    title,
    original_filename: originalFilename,
    storage_path: storagePath,
    mime_type: fileType.mimeType,
    byte_size: input.byteSize,
  });

  if (insertError) {
    return { error: "We could not prepare that file for upload. Please try again." };
  }

  return {
    document: {
      id: documentId,
      storagePath,
      mimeType: fileType.mimeType,
    },
  };
}

export async function cancelPreparedDocument(documentId: string) {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated || !isValidUuid(documentId)) {
    return;
  }

  await authenticated.supabase.from("documents").delete().eq("id", documentId);
}

export async function processDocument(documentId: string): Promise<ProcessDocumentResult> {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated) {
    return { error: authenticated.error };
  }

  if (!isValidUuid(documentId)) {
    return { error: "That source could not be found." };
  }

  if (!isDocumentProcessingConfigured()) {
    return {
      error:
        "Document processing is not configured yet. Add the server-only Supabase secret key, then try again.",
    };
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
          : "AI source processing is not configured correctly.",
    };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (embeddingMode === "openai" && !openAiApiKey) {
    return {
      error:
        "AI source processing is not configured yet. Add the server-only OpenAI API key, then try again.",
    };
  }

  const { data: document, error: documentError } = await authenticated.supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("owner_id", authenticated.userId)
    .maybeSingle();

  if (documentError || !document) {
    return { error: "That source could not be found." };
  }

  if (document.status === "ready") {
    return { error: "This source has already been processed." };
  }

  if (document.status === "processing") {
    return { error: "This source is already being processed. Refresh in a moment." };
  }

  const admin = createAdminClient();
  let processingToken: string | null = null;

  try {
    const { data: claimedData, error: claimError } = await admin
      .rpc("claim_document_processing", {
        p_document_id: documentId,
        p_expected_owner_id: authenticated.userId,
      })
      .maybeSingle();
    const claimed = claimedData as ClaimedDocument | null;

    if (claimError || !claimed || !isValidUuid(claimed.processing_token)) {
      return { error: "This source is unavailable for processing. Refresh the page and try again." };
    }

    processingToken = claimed.processing_token;
    const expectedByteSize = Number(claimed.byte_size);

    if (
      !Number.isSafeInteger(expectedByteSize) ||
      expectedByteSize < 1 ||
      expectedByteSize > MAX_DOCUMENT_SIZE_BYTES
    ) {
      throw new DocumentIngestionError("The uploaded file could not be verified.");
    }

    const { data: file, error: downloadError } = await admin.storage
      .from(COURSE_MATERIALS_BUCKET)
      .download(claimed.storage_path);

    if (downloadError || !file) {
      throw new DocumentIngestionError(
        "The uploaded file could not be found. Upload it again and retry processing.",
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.byteLength !== expectedByteSize) {
      throw new DocumentIngestionError("The uploaded file could not be verified. Upload it again.");
    }

    const extracted = await extractDocumentSource({
      bytes,
      mimeType: claimed.mime_type,
    });
    const sourceChunks = extracted.chunks.map((chunk) => chunk.content);
    const embeddings =
      embeddingMode === "mock"
        ? createMockEmbeddings(sourceChunks)
        : await generateEmbeddings(new OpenAI({ apiKey: openAiApiKey }), sourceChunks);
    const { data: completed, error: completeError } = await admin.rpc(
      "complete_document_ingestion",
      {
        p_document_id: documentId,
        p_processing_token: processingToken,
        p_sections: extracted.sections.map((section) => ({
          section_index: section.sectionIndex,
          page_number: section.pageNumber,
          heading: section.heading,
          source_text: section.sourceText,
        })),
        p_chunks: extracted.chunks.map((chunk, index) => ({
          section_index: chunk.sectionIndex,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: embeddings[index],
        })),
      },
    );

    if (completeError) {
      throw new DocumentIngestionError(
        "The extracted source could not be saved. Please retry processing.",
      );
    }

    if (completed !== true) {
      return { error: "This source is no longer available for processing." };
    }

    revalidatePath("/sources");
    revalidatePath("/dashboard");

    return {
      processed: {
        sections: extracted.sections.length,
        chunks: extracted.chunks.length,
        embeddingMode,
      },
    };
  } catch (error) {
    const safeError =
      error instanceof EmbeddingGenerationError
        ? error.message
        : userFacingIngestionError(error);

    if (processingToken) {
      await admin.rpc("fail_document_ingestion", {
        p_document_id: documentId,
        p_processing_token: processingToken,
        p_safe_error: safeError,
      });
    }

    revalidatePath("/sources");
    return { error: safeError };
  }
}

export async function deleteDocument(documentId: string): Promise<{ error?: string }> {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated) {
    return { error: authenticated.error };
  }

  if (!isValidUuid(documentId)) {
    return { error: "That source could not be found." };
  }

  const { data: document, error: documentError } = await authenticated.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !document) {
    return { error: "That source could not be found." };
  }

  const { error: storageError } = await authenticated.supabase.storage
    .from(COURSE_MATERIALS_BUCKET)
    .remove([document.storage_path]);

  if (storageError) {
    return { error: "We could not remove the private file. Please try again." };
  }

  const { error: deleteError } = await authenticated.supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return { error: "The file was removed, but its record could not be cleared. Please try again." };
  }

  revalidatePath("/sources");
  revalidatePath("/dashboard");

  return {};
}
