import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
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
      <nav className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-6 sm:px-12">
        <Link href="/dashboard" className="text-lg font-bold tracking-[0.18em]">
          AI STUDY
        </Link>
        <form action={signOut}>
          <button
            className="rounded border border-black/30 px-4 py-2 text-sm font-semibold transition hover:bg-black hover:text-white"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-12 sm:px-12">
        <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Private workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">You’re signed in.</h1>
        <p className="mt-3 text-lg text-[#565650]">Signed in as {email}.</p>

        <div className="mt-10 rounded-xl border border-black/15 bg-white p-7 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
          <h2 className="text-xl font-semibold">Your materials are ready for the next step.</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[#565650]">
            Uploading course documents, generating printable materials, and the source-cited tutor will be added here next.
          </p>
        </div>
      </section>
    </main>
  );
}
