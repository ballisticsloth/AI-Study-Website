import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceNav } from "@/components/workspace-nav";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims) {
    redirect("/sign-in");
  }

  const email = typeof claims.email === "string" ? claims.email : "your account";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <WorkspaceNav active="home" avatarInitial={(email[0] ?? "A").toUpperCase()} />

      <section className="paper-grid min-h-[calc(100vh-4rem)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[var(--source-teal)] uppercase">
              <span className="size-1.5 rounded-full bg-[var(--verified-green)]" />
              Your private workspace
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-[var(--source-teal)] sm:text-5xl">Start with your course sources.</h1>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">Upload a PDF, DOCX, or TXT file and use it to create cited study tools.</p>
          </div>

          <div className="mt-10 grid overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_16px_45px_rgba(38,70,83,0.07)] lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] text-[var(--verified-green)] uppercase">First step</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Add the sources that matter.</h2>
                </div>
                <span className="rounded-full border border-[var(--verified-green)]/25 bg-[#edf7f5] px-3 py-1 text-xs font-semibold text-[#20766b]">Private</span>
              </div>
              <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
                Keep each course organized, prepare sources for citation, and choose exactly what assessments and tutor conversations can use.
              </p>
              <Link
                className="mt-7 inline-flex bg-[var(--source-teal)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--source-teal-dark)]"
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
