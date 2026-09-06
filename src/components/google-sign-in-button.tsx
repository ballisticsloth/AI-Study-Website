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
    <div className="mt-8">
      <button
        className="ui-button-secondary w-full disabled:cursor-wait"
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
          className="mt-4 rounded-[var(--radius)] border border-[#b9452d]/30 bg-[#fff1ee] px-4 py-3 text-sm text-[#8f321f]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
