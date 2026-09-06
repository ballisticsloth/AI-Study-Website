import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
      <path d="M3 8h9M9 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
    </svg>
  );
}

const features = [
  { number: "01", title: "Add your course sources", description: "Keep PDFs, documents, and notes private and organized by course." },
  { number: "02", title: "Create editable assessments", description: "Generate worksheets and questions, then review every detail before using them." },
  { number: "03", title: "Get citation-backed tutoring", description: "Ask for explanations and hints with the supporting source, page, and excerpt attached." },
];

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="border-b border-[var(--border)] bg-white">
        <div className="page-container flex h-[72px] items-center justify-between">
          <BrandWordmark />
          <div className="flex items-center gap-2">
            <Link className="hidden px-4 py-3 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--source-teal)] sm:inline-flex" href="/sign-in">Sign in</Link>
            <Link className="ui-button-primary" href="/sign-in">Create your workspace <ArrowIcon /></Link>
          </div>
        </div>
      </nav>

      <section className="paper-grid border-b border-[var(--border)]">
        <div className="page-container grid items-center gap-16 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-32">
          <div className="max-w-xl">
            <p className="ui-eyebrow">AI grounded in your course</p>
            <h1 className="page-title mt-6 max-w-[10ch]">Teach and study from the source.</h1>
            <p className="body-large mt-6 max-w-lg">Turn private course materials into editable assessments and citation-backed study guidance your students can trust.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link className="ui-button-primary" href="/sign-in">Create your workspace <ArrowIcon /></Link>
              <Link className="ui-button-secondary" href="/sign-in">Sign in</Link>
            </div>
            <ul className="mt-8 grid gap-2 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)] sm:grid-cols-3">
              {["Private by default", "Backed by your sources", "Review before use"].map((item) => (
                <li className="flex items-center gap-2" key={item}>
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#edf7f5] text-[var(--verified-green)]"><CheckIcon /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <section aria-label="StudySourced AI workspace preview" className="ui-card-raised overflow-hidden">
            <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--source-teal)]">Biology 10</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Course workspace</p>
              </div>
              <span className="ui-badge"><span className="size-1.5 rounded-full bg-[var(--verified-green)]" />4 sources ready</span>
            </header>
            <div className="grid sm:grid-cols-[10rem_1fr]">
              <aside className="hidden border-r border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:block">
                <p className="text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">Workspace</p>
                <div className="mt-4 grid gap-1 text-sm">
                  {["Home", "Sources", "Assessments", "Study Tutor"].map((item) => (
                    <span className={`rounded-[var(--radius)] px-3 py-2 ${item === "Study Tutor" ? "bg-[#edf7f5] font-semibold text-[var(--source-teal)]" : "text-[var(--muted)]"}`} key={item}>{item}</span>
                  ))}
                </div>
              </aside>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--source-teal)]">Cell membrane review</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Guidance uses only two selected sources.</p>
                  </div>
                  <span className="ui-badge">Source-backed</span>
                </div>
                <div className="space-y-4 py-6 text-sm leading-6">
                  <div className="ml-auto max-w-[84%] rounded-[var(--radius)] bg-[var(--source-teal)] px-4 py-3 text-white">Why does the cell membrane matter?</div>
                  <div className="max-w-[94%] border-l-2 border-[var(--verified-green)] bg-[#f4f8f7] px-4 py-3">
                    Think about what must enter and leave a cell. What could happen if that movement were not controlled?
                    <div className="mt-4 border-t border-[var(--border)] pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold text-[var(--source-teal)]">Cell Structure Notes · Page 4</p>
                        <span className="text-xs font-semibold tracking-[0.08em] text-[var(--verified-green)] uppercase">Citation 01</span>
                      </div>
                      <p className="source-quote mt-2 text-sm leading-6 text-[#40403c]">“The plasma membrane selectively controls the movement of substances into and out of the cell.”</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
                  <div className="ui-control flex min-h-12 flex-1 items-center text-sm text-[#777770]">Ask a follow-up about your sources…</div>
                  <span className="ui-button-primary size-12 shrink-0 p-0"><ArrowIcon /></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="bg-white">
        <div className="page-container py-24 lg:py-32">
          <div className="grid gap-6 border-b border-[var(--border)] pb-8 lg:grid-cols-[0.75fr_1.25fr]">
            <p className="ui-eyebrow">One trusted workflow</p>
            <h2 className="section-title max-w-3xl">Your course stays at the center of every study tool.</h2>
          </div>
          <div className="grid lg:grid-cols-3">
            {features.map((feature) => (
              <article className="border-b border-[var(--border)] py-8 lg:border-r lg:border-b-0 lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0" key={feature.number}>
                <span className="text-xs font-semibold tracking-[0.1em] text-[var(--verified-green)]">{feature.number}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-[var(--source-teal)]">{feature.title}</h3>
                <p className="mt-4 leading-7 text-[var(--muted)]">{feature.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-16 flex flex-col items-start justify-between gap-6 border border-[var(--source-teal)] bg-[var(--source-teal)] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-8">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[#a9d9d2] uppercase">StudySourced AI</p>
              <p className="mt-2 text-xl font-medium tracking-[-0.02em]">Your course. Your sources. Clearer understanding.</p>
            </div>
            <Link className="ui-button-inverse shrink-0" href="/sign-in">Create your workspace <ArrowIcon /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="page-container flex flex-col gap-4 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <BrandWordmark compact />
          <p>Private course materials become trusted study guidance.</p>
        </div>
      </footer>
    </main>
  );
}
