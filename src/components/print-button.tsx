"use client";

export function PrintButton() {
  return <button className="bg-[var(--source-teal)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--source-teal-dark)]" onClick={() => window.print()}>Print</button>;
}
