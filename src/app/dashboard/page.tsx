import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceNav } from "@/components/workspace-nav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Workspace | StudySourced AI",
  description: "Start with private course sources and create citation-backed study tools.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims) {
    redirect("/sign-in");
  }

  const email = typeof claims.email === "string" ? claims.email : "your account";

  return (
    <main className="page-shell">
      <WorkspaceNav active="home" avatarInitial={(email[0] ?? "A").toUpperCase()} />

      <section className="paper-grid min-h-[calc(100vh-4rem)] border-b border-[var(--border)]">
        <div className="page-container py-16 lg:py-24">
          <div className="max-w-3xl">
            <p className="ui-eyebrow">Your private workspace</p>
            <h1 className="page-title mt-6">Start with your course sources.</h1>
            <p className="body-large mt-4">Upload a PDF, DOCX, or TXT file and use it to create cited study tools.</p>
          </div>

          <div className="ui-card mt-10 grid overflow-hidden lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="ui-eyebrow">First step</p>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Add the sources that matter.</h2>
                </div>
                <span className="ui-badge">Private</span>
              </div>
              <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
                Keep each course organized, prepare sources for citation, and choose exactly what assessments and tutor conversations can use.
              </p>
              <Link
                className="ui-button-primary mt-8"
                href="/sources"
              >
                Add course sources
              </Link>
            </div>
            <div className="border-t border-[var(--border)] bg-[#fbfbf9] p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <p className="text-xs font-bold tracking-[0.14em] text-[var(--muted)] uppercase">Workspace principle</p>
              <p className="source-quote mt-4 text-lg leading-8 text-[var(--source-teal)]">Your course. Your sources. Clearer understanding.</p>
              <p className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">Signed in as {email}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
