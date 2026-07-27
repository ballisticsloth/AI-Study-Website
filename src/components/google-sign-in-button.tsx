"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError || !data.url) {
      setError("We could not start Google sign-in. Please try again.");
      setIsLoading(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="mt-7">
      <button
        className="flex w-full items-center justify-center gap-3 rounded-md border border-black/20 bg-white px-4 py-3 text-sm font-semibold text-[#191919] transition hover:bg-[#f7f7f5] focus:outline-none focus:ring-2 focus:ring-[#264653] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        disabled={isLoading}
        onClick={handleGoogleSignIn}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full bg-[#4285f4] text-xs font-bold text-white"
        >
          G
        </span>
        {isLoading ? "Opening Google…" : "Continue with Google"}
      </button>

      {error ? (
        <p
          className="mt-4 rounded-md border border-[#b9452d]/30 bg-[#fff1ee] px-3 py-2 text-sm text-[#8f321f]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
