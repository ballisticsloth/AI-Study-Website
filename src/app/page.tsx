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
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 20 20">
      <path d="M5 2.75h6l4 4V17.25H5z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M11 2.75v4h4M7.5 10h5M7.5 13h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

const features = [
  {
    number: "01",
    title: "Add your course sources",
    description: "Keep PDFs, documents, and notes private and organized by course.",
  },
  {
    number: "02",
    title: "Create editable assessments",
    description: "Generate worksheets and questions, then review every detail before using them.",
  },
  {
    number: "03",
    title: "Get citation-backed tutoring",
    description: "Ask for explanations and hints with the supporting source, page, and excerpt attached.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <nav className="relative z-20 border-b border-[var(--border)] bg-white/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandWordmark />
          <div className="flex items-center gap-2 text-sm font-semibold sm:gap-3">
            <Link
              href="/sign-in"
              className="hidden px-3 py-2 text-[var(--muted)] transition hover:text-[var(--source-teal)] sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 bg-[var(--source-teal)] px-4 py-2.5 text-white transition hover:bg-[var(--source-teal-dark)]"
            >
              Create your workspace
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </nav>

      <section className="paper-grid relative border-b border-[var(--border)]">
        <div className="absolute inset-y-0 left-[7%] hidden w-px bg-[var(--terracotta)]/30 xl:block" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:px-12 lg:py-24 xl:py-28">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.17em] text-[var(--source-teal)] uppercase sm:text-sm">
              <span className="size-1.5 rounded-full bg-[var(--verified-green)]" />
              AI grounded in your course
            </div>
            <h1 className="mt-6 max-w-[10ch] text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-[var(--source-teal)]">
              Teach and study from the source.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl sm:leading-9">
              Turn private course materials into editable assessments and citation-backed study guidance your students can trust.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 bg-[var(--source-teal)] px-5 py-3.5 font-semibold text-white transition hover:bg-[var(--source-teal-dark)]"
              >
                Create your workspace
                <ArrowIcon />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex border border-[var(--border)] bg-white px-5 py-3.5 font-semibold text-[var(--source-teal)] transition hover:border-[var(--source-teal)]"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
              {["Private by default", "Backed by your sources", "Review before use"].map((item) => (
                <span className="inline-flex items-center gap-2" key={item}>
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--verified-green)]/12 text-[var(--verified-green)]">
                    <CheckIcon />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[42rem] lg:mx-0 lg:ml-auto">
            <div className="absolute -left-5 top-12 z-10 hidden rounded border border-[var(--study-gold)]/60 bg-[#fff8e4] px-3 py-2 text-xs font-semibold text-[#6b5418] shadow-sm sm:block">
              Teacher reviewed
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_24px_70px_rgba(38,70,83,0.12)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[#fbfbf9] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-[var(--source-teal)] text-white">
                    <PageIcon />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--source-teal)]">Biology 10</p>
                    <p className="text-xs text-[var(--muted)]">Course workspace</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f5f2] px-2.5 py-1 text-xs font-semibold text-[#20766b]">
                  <span className="size-1.5 rounded-full bg-[var(--verified-green)]" />
                  4 sources ready
                </span>
              </div>

              <div className="grid min-h-[29rem] sm:grid-cols-[10.5rem_1fr]">
                <div className="hidden border-r border-[var(--border)] bg-[#fbfbf9] p-3 sm:block">
                  <p className="px-2 pt-1 text-[0.68rem] font-bold tracking-[0.12em] text-[var(--muted)] uppercase">Workspace</p>
                  <div className="mt-3 space-y-1 text-sm">
                    {["Home", "Sources", "Assessments", "Study Tutor"].map((item) => (
                      <div
                        className={`rounded-md px-2.5 py-2 ${item === "Study Tutor" ? "bg-[#e9f3f1] font-semibold text-[var(--source-teal)]" : "text-[var(--muted)]"}`}
                        key={item}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 border-t border-[var(--border)] px-2 pt-4">
                    <p className="text-[0.68rem] font-bold tracking-[0.12em] text-[var(--muted)] uppercase">Selected sources</p>
                    <p className="mt-2 text-xs font-medium leading-5 text-[var(--source-teal)]">Cell Structure Notes</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-[var(--source-teal)]">Chapter 3 Reading</p>
                  </div>
                </div>

                <div className="flex flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--source-teal)]">Cell membrane review</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Guidance uses only 2 selected sources</p>
                    </div>
                    <span className="rounded border border-[var(--verified-green)]/25 bg-[#f1f8f6] px-2 py-1 text-[0.68rem] font-semibold text-[#20766b]">Source-backed</span>
                  </div>

                  <div className="flex-1 space-y-4 py-5">
                    <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-[var(--source-teal)] px-4 py-3 text-sm leading-6 text-white">
                      Why does the cell membrane matter?
                    </div>
                    <div className="max-w-[95%] rounded-lg rounded-bl-sm border border-[var(--border)] bg-[#fbfbf9] px-4 py-3 text-sm leading-6">
                      Think about what must enter and leave a cell. What could happen if that movement were not controlled?
                      <div className="mt-3 border-l-2 border-[var(--verified-green)] bg-white px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[var(--source-teal)]">Cell Structure Notes · Page 4</p>
                          <span className="text-[0.65rem] font-bold tracking-[0.1em] text-[var(--verified-green)] uppercase">Citation 01</span>
                        </div>
                        <p className="source-quote mt-1.5 text-[0.78rem] leading-5 text-[#40403c]">
                          “The plasma membrane selectively controls the movement of substances into and out of the cell.”
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4">
                    <div className="flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-xs text-[#777770]">Ask a follow-up about your sources…</div>
                    <div className="grid size-9 place-items-center rounded-md bg-[var(--source-teal)] text-white"><ArrowIcon /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 right-6 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--source-teal)] shadow-[0_8px_24px_rgba(38,70,83,0.12)]">
              Source · page · excerpt
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid gap-8 border-b border-[var(--border)] pb-10 lg:grid-cols-[0.7fr_1.3fr]">
            <p className="text-xs font-bold tracking-[0.17em] text-[var(--source-teal)] uppercase">One trusted workflow</p>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--source-teal)] sm:text-4xl">
              Your course stays at the center of every study tool.
            </h2>
          </div>

          <div className="grid lg:grid-cols-3">
            {features.map((feature) => (
              <article className="border-b border-[var(--border)] py-8 lg:border-r lg:border-b-0 lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0" key={feature.number}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--verified-green)]">[{feature.number}]</span>
                  <span className="h-px w-12 bg-[var(--border)]" />
                </div>
                <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-[var(--source-teal)]">{feature.title}</h3>
                <p className="mt-3 max-w-sm leading-7 text-[var(--muted)]">{feature.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-lg bg-[var(--source-teal)] px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#a9d9d2] uppercase">StudySourced AI</p>
              <p className="mt-2 text-xl font-medium tracking-[-0.02em]">Your course. Your sources. Clearer understanding.</p>
            </div>
            <Link
              href="/sign-in"
              className="inline-flex shrink-0 items-center gap-2 border border-white/35 px-4 py-2.5 text-sm font-semibold transition hover:bg-white hover:text-[var(--source-teal)]"
            >
              Create your workspace
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[#fbfbf9]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <BrandWordmark compact />
          <p>Private course materials become trusted study guidance.</p>
        </div>
      </footer>
    </main>
  );
}
