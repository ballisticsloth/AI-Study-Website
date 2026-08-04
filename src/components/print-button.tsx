"use client";

export function PrintButton() {
  return <button className="rounded bg-[#264653] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}>Print</button>;
}
