import { redirect } from "next/navigation";

import { AssessmentsWorkspace } from "@/components/assessments-workspace";
import { WorkspaceNav } from "@/components/workspace-nav";
import { parseSavedAssessment } from "@/lib/assessments";
import { type CourseSummary, type DocumentStatus, type DocumentSummary } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (error || !claims || typeof claims.sub !== "string") redirect("/sign-in");

  const [{ data: courses }, { data: documents }, { data: materials }] = await Promise.all([
    supabase.from("courses").select("id, title").order("created_at"),
    supabase.from("documents").select("id, course_id, title, original_filename, storage_path, mime_type, byte_size, status, processing_error, created_at").order("created_at", { ascending: false }),
    supabase.from("generated_materials").select("id, course_id, type, title, directions, generation_settings, created_at, updated_at, material_questions(id, question_index, prompt, question_type, options, correct_answer, explanation, citations)").order("updated_at", { ascending: false }),
  ]);
  const assessmentItems = (materials ?? []).flatMap((material) => { try { return [parseSavedAssessment(material)]; } catch { return []; } });
  const courseItems: CourseSummary[] = (courses ?? []).map((course) => ({ id: course.id, title: course.title }));
  const documentItems: DocumentSummary[] = (documents ?? []).map((document) => ({ id: document.id, courseId: document.course_id, title: document.title, originalFilename: document.original_filename, storagePath: document.storage_path, mimeType: document.mime_type, byteSize: Number(document.byte_size), status: document.status as DocumentStatus, processingError: document.processing_error, createdAt: document.created_at }));
  const email = typeof claims.email === "string" ? claims.email : "";
  return <main className="min-h-screen bg-[#f7f7f5] text-[#191919]"><WorkspaceNav active="assessments" avatarInitial={(email[0] ?? "A").toUpperCase()} /><AssessmentsWorkspace courses={courseItems} documents={documentItems} assessments={assessmentItems} /></main>;
}
