import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f2f2f2] text-[#191919]">
      <nav className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-6 sm:px-12">
        <Link href="/" className="text-lg font-bold tracking-[0.18em]">
          AI STUDY
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/sign-in"
            className="rounded border border-black/35 px-4 py-2 transition hover:bg-black hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-6 py-16 sm:px-12 lg:grid-cols-[1fr_0.9fr] lg:py-24">
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">
            Built for meaningful learning
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Teach toward understanding—not just answers.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#565650]">
            Turn private course materials into editable assessments and
            source-grounded study guidance your students can trust.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/sign-in"
              className="rounded bg-[#264653] px-5 py-3 font-semibold text-white transition hover:bg-[#1d3741]"
            >
              Continue with Google
            </Link>
            <Link
              href="/sign-in"
              className="rounded border border-black/30 bg-white px-5 py-3 font-semibold transition hover:border-black"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-black/15 bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8">
          <div className="flex items-center gap-2 border-b border-black/10 pb-4">
            <span className="size-3 rounded-full bg-[#e76f51]" />
            <span className="size-3 rounded-full bg-[#e9c46a]" />
            <span className="size-3 rounded-full bg-[#2a9d8f]" />
            <span className="ml-3 text-sm text-[#6b6b67]">Your study workspace</span>
          </div>
          <div className="space-y-5 py-7">
            <div className="rounded-lg border border-[#264653]/20 bg-[#f0f6f5] p-4">
              <p className="text-sm font-semibold text-[#264653]">Upload course material</p>
              <p className="mt-1 text-sm text-[#565650]">Keep files private and ready for citation.</p>
            </div>
            <div className="rounded-lg border border-black/10 p-4">
              <p className="text-sm font-semibold">Generate a printable worksheet</p>
              <p className="mt-1 text-sm text-[#565650]">Review and edit every question before use.</p>
            </div>
            <div className="rounded-lg border border-black/10 p-4">
              <p className="text-sm font-semibold">Ask the tutor for a hint</p>
              <p className="mt-1 text-sm text-[#565650]">See the supporting source, page, and excerpt.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
