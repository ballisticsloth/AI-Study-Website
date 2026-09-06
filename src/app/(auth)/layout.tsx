import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="page-shell paper-grid">
      <nav className="border-b border-[var(--border)] bg-white/95">
        <div className="page-container flex h-[72px] items-center justify-between">
          <BrandWordmark />
          <Link href="/" className="text-sm font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--source-teal)] hover:underline">← Back to home</Link>
        </div>
      </nav>
      <div className="page-container grid min-h-[calc(100vh-72px)] items-center gap-16 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
        <section className="hidden max-w-lg lg:block">
          <p className="ui-eyebrow">Private by default</p>
          <h1 className="page-title mt-6 max-w-[10ch]">
            Your course sources stay yours.
          </h1>
          <p className="body-large mt-6">
            Build assessments and study guidance from a private workspace where every citation stays connected to its source.
          </p>
          <div className="mt-8 border-l-2 border-[var(--verified-green)] bg-white/65 px-4 py-4">
            <p className="source-quote text-base leading-7 text-[#3f3f3a]">
              “Keep the course sources visible, the guidance grounded, and the teacher in control.”
            </p>
          </div>
        </section>
        <section className="ui-card-raised w-full max-w-md justify-self-center p-6 sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
