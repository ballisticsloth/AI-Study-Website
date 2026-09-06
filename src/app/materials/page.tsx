import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { MaterialsWorkspace } from "@/components/materials-workspace";
import { WorkspaceNav } from "@/components/workspace-nav";
import {
  type CourseSummary,
  type DocumentStatus,
  type DocumentSummary,
} from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sources | StudySourced AI",
  description: "Keep private course sources organized and ready for cited study tools.",
};

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims || typeof claims.sub !== "string") {
    redirect("/sign-in");
  }

  const [{ data: courses }, { data: documents }] = await Promise.all([
    supabase.from("courses").select("id, title").order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select(
        "id, course_id, title, original_filename, storage_path, mime_type, byte_size, status, processing_error, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const courseSummaries: CourseSummary[] = (courses ?? []).map((course) => ({
    id: course.id,
    title: course.title,
  }));

  const documentSummaries: DocumentSummary[] = (documents ?? []).map((document) => ({
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

  const email = typeof claims.email === "string" ? claims.email : "";

  return (
    <main className="page-shell">
      <WorkspaceNav active="sources" avatarInitial={(email[0] ?? "A").toUpperCase()} />
      <MaterialsWorkspace initialCourses={courseSummaries} documents={documentSummaries} />
    </main>
  );
}
