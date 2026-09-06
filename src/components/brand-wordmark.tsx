import Link from "next/link";

type BrandWordmarkProps = {
  href?: string;
  compact?: boolean;
};

export function BrandWordmark({ href = "/", compact = false }: BrandWordmarkProps) {
  return (
    <Link
      aria-label="StudySourced AI home"
      className="inline-flex shrink-0 items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.025em] text-[var(--source-teal)]"
      href={href}
    >
      <span>StudySourced</span>
      <span
        className={`inline-flex items-center justify-center rounded-[0.3rem] bg-[var(--verified-green)] font-bold tracking-[0.08em] text-white ${
          compact ? "h-5 px-1.5 text-[0.62rem]" : "h-[1.35rem] px-1.5 text-[0.65rem]"
        }`}
      >
        AI
      </span>
    </Link>
  );
}
