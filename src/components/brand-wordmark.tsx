import Link from "next/link";

type BrandWordmarkProps = {
  href?: string;
  compact?: boolean;
};

export function BrandWordmark({ href = "/", compact = false }: BrandWordmarkProps) {
  return (
    <Link
      aria-label="StudySourced AI home"
      className="inline-flex shrink-0 items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-[var(--source-teal)]"
      href={href}
    >
      <span>StudySourced</span>
      <span
        className={`inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--verified-green)] font-bold tracking-[0.08em] text-white ${
          compact ? "h-5 px-2 text-[0.625rem]" : "h-6 px-2 text-xs"
        }`}
      >
        AI
      </span>
    </Link>
  );
}
