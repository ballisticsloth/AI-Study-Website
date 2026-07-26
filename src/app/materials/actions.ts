"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  getSupportedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentExtension,
} from "@/lib/materials";
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

  revalidatePath("/materials");
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
    return { error: "Files must be between 1 byte and 20 MB." };
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

export async function deleteDocument(documentId: string): Promise<{ error?: string }> {
  const authenticated = await getAuthenticatedSupabase();

  if ("error" in authenticated) {
    return { error: authenticated.error };
  }

  if (!isValidUuid(documentId)) {
    return { error: "That material could not be found." };
  }

  const { data: document, error: documentError } = await authenticated.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !document) {
    return { error: "That material could not be found." };
  }

  const { error: storageError } = await authenticated.supabase.storage
    .from("course-materials")
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

  revalidatePath("/materials");
  revalidatePath("/dashboard");

  return {};
}
