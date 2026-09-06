import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { BrandWordmark } from "@/components/brand-wordmark";

type WorkspaceNavProps = {
  active: "home" | "sources" | "assessments" | "tutor";
  avatarInitial: string;
};

function navClassName(isActive: boolean) {
  return `relative inline-flex h-16 items-center px-3 text-sm font-medium transition after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 ${
    isActive
      ? "text-[var(--source-teal)] after:bg-[var(--verified-green)]"
      : "text-[var(--muted)] after:bg-transparent hover:text-[var(--source-teal)]"
  }`;
}

const navigation = [
  { href: "/dashboard", key: "home", label: "Home" },
  { href: "/sources", key: "sources", label: "Sources" },
  { href: "/assessments", key: "assessments", label: "Assessments" },
  { href: "/tutor", key: "tutor", label: "Study Tutor" },
] as const;

export function WorkspaceNav({ active, avatarInitial }: WorkspaceNavProps) {
  return (
    <nav className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <BrandWordmark href="/dashboard" compact />

        <div className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation">
          {navigation.map((item) => (
            <Link href={item.href} className={navClassName(active === item.key)} key={item.key}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span
            aria-label="Your account"
            className="grid size-8 place-items-center rounded-full bg-[var(--source-teal)] text-xs font-bold text-white"
          >
            {avatarInitial}
          </span>
          <form action={signOut}>
            <button
              className="border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--source-teal)] transition hover:border-[var(--source-teal)]"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-[var(--border)] px-2 md:hidden" aria-label="Workspace navigation">
        <div className="flex min-w-max items-center">
          {navigation.map((item) => (
            <Link href={item.href} className={navClassName(active === item.key)} key={item.key}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
