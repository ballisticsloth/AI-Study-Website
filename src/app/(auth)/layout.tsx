import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="paper-grid min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <nav className="border-b border-[var(--border)] bg-white/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <BrandWordmark />
        <Link
          href="/"
          className="text-sm font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--source-teal)] hover:underline"
        >
          ← Back to home
        </Link>
        </div>
      </nav>
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-6xl items-center gap-14 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-20">
        <section className="hidden max-w-lg lg:block">
          <p className="inline-flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[var(--source-teal)] uppercase">
            <span className="size-1.5 rounded-full bg-[var(--verified-green)]" />
            Private by default
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--source-teal)]">
            Your course sources stay yours.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            Build assessments and study guidance from a private workspace where every citation stays connected to its source.
          </p>
          <div className="mt-9 border-l-2 border-[var(--verified-green)] bg-white/65 px-5 py-4">
            <p className="source-quote text-base leading-7 text-[#3f3f3a]">
              “Keep the course sources visible, the guidance grounded, and the teacher in control.”
            </p>
          </div>
        </section>
        <section className="w-full max-w-md justify-self-center rounded-xl border border-[var(--border)] bg-white p-6 shadow-[0_22px_60px_rgba(38,70,83,0.1)] sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
