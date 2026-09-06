import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { TutorWorkspace } from "@/components/tutor-workspace";
import { WorkspaceNav } from "@/components/workspace-nav";
import { type CourseSummary, type DocumentStatus, type DocumentSummary } from "@/lib/materials";
import { parseTutorConversation } from "@/lib/tutor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Study Tutor | StudySourced AI",
  description: "Ask about your course and receive citation-backed guidance from selected sources.",
};

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (error || !claims || typeof claims.sub !== "string") redirect("/sign-in");

  const [{ data: courses }, { data: documents }, { data: conversations }] = await Promise.all([
    supabase.from("courses").select("id, title").order("created_at"),
    supabase
      .from("documents")
      .select("id, course_id, title, original_filename, storage_path, mime_type, byte_size, status, processing_error, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("tutor_conversations")
      .select("id, course_id, title, topic_focus, source_document_ids, created_at, updated_at, tutor_messages(id, role, content, citations, created_at)")
      .order("updated_at", { ascending: false }),
  ]);

  const courseItems: CourseSummary[] = (courses ?? []).map((course) => ({
    id: course.id,
    title: course.title,
  }));
  const documentItems: DocumentSummary[] = (documents ?? []).map((document) => ({
    id: document.id,
    courseId: document.course_id,
    title: document.title,
    originalFilename: document.original_filename,
    storagePath: document.storage_path,
    mimeType: document.mime_type,
    byteSize: Number(document.byte_size),
    status: document.status as DocumentStatus,
    processingError: document.processing_error,
    createdAt: document.created_at,
  }));
  const conversationItems = (conversations ?? []).flatMap((conversation) => {
    try {
      return [parseTutorConversation(conversation)];
    } catch {
      return [];
    }
  });
  const email = typeof claims.email === "string" ? claims.email : "";

  return (
    <main className="page-shell">
      <WorkspaceNav active="tutor" avatarInitial={(email[0] ?? "A").toUpperCase()} />
      <TutorWorkspace courses={courseItems} documents={documentItems} conversations={conversationItems} />
    </main>
  );
}
