import Link from "next/link";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-[#f2f2f2] text-[#191919]">
      <nav className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-6 sm:px-12">
        <Link href="/" className="text-lg font-bold tracking-[0.18em]">
          AI STUDY
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-[#565650] underline-offset-4 hover:text-black hover:underline"
        >
          Back to home
        </Link>
      </nav>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-[0.9fr_1fr] lg:px-12">
        <section className="hidden max-w-md lg:block">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">
            Private by default
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Your course materials stay yours.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#565650]">
            Create, revise, and print study materials from a secure workspace built for thoughtful teaching.
          </p>
        </section>
        <section className="w-full max-w-md justify-self-center rounded-xl border border-black/15 bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
