import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";

type WorkspaceNavProps = {
  active: "home" | "materials";
  avatarInitial: string;
};

function navClassName(isActive: boolean) {
  return `rounded px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-[#e8f0ef] text-[#264653]"
      : "text-[#565650] hover:bg-black/5 hover:text-[#191919]"
  }`;
}

export function WorkspaceNav({ active, avatarInitial }: WorkspaceNavProps) {
  return (
    <nav className="border-b border-black/10 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 sm:px-12">
        <Link href="/dashboard" className="shrink-0 text-lg font-bold tracking-[0.18em]">
          AI STUDY
        </Link>

        <div className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation">
          <Link href="/dashboard" className={navClassName(active === "home")}>
            Home
          </Link>
          <Link href="/materials" className={navClassName(active === "materials")}>
            Materials
          </Link>
          <span
            aria-label="AI tutor, coming soon"
            className="cursor-not-allowed rounded px-3 py-2 text-sm font-medium text-[#9a9a94]"
          >
            AI Tutor
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            aria-label="Your account"
            className="grid size-8 place-items-center rounded-full bg-[#264653] text-xs font-bold text-white"
          >
            {avatarInitial}
          </span>
          <form action={signOut}>
            <button
              className="rounded border border-black/30 px-3 py-1.5 text-sm font-semibold transition hover:bg-black hover:text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
