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
    <main className="min-h-screen bg-[#f7f7f5] text-[#191919]">
      <WorkspaceNav active="home" avatarInitial={(email[0] ?? "A").toUpperCase()} />

      <section className="mx-auto max-w-5xl px-6 py-12 sm:px-12">
        <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Private workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">You’re signed in.</h1>
        <p className="mt-3 text-lg text-[#565650]">Signed in as {email}.</p>

        <div className="mt-10 rounded-xl border border-black/15 bg-white p-7 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
          <h2 className="text-xl font-semibold">Start with your course materials.</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[#565650]">
            Upload a private PDF, DOCX, or TXT file. The next milestone will turn those sources into cited study tools.
          </p>
          <Link
            className="mt-6 inline-flex rounded bg-[#264653] px-5 py-3 font-semibold text-white transition hover:bg-[#1d3741]"
            href="/materials"
          >
            Open materials workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
