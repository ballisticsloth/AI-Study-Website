"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function readRequiredText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function toMessageUrl(path: string, key: "error" | "message", message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

export async function signIn(formData: FormData) {
  const email = readRequiredText(formData, "email").toLowerCase();
  const password = readRequiredText(formData, "password");

  if (!email || !password) {
    redirect(toMessageUrl("/sign-in", "error", "Enter both an email address and password."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      toMessageUrl(
        "/sign-in",
        "error",
        "We could not sign you in. Check your email and password, then try again.",
      ),
    );
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const displayName = readRequiredText(formData, "displayName");
  const email = readRequiredText(formData, "email").toLowerCase();
  const password = readRequiredText(formData, "password");

  if (!displayName || !email || !password) {
    redirect(toMessageUrl("/sign-up", "error", "Complete every field to create an account."));
  }

  if (password.length < 8) {
    redirect(toMessageUrl("/sign-up", "error", "Use a password with at least 8 characters."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    redirect(
      toMessageUrl(
        "/sign-up",
        "error",
        "We could not create that account. Please try again shortly.",
      ),
    );
  }

  // With Confirm Email disabled for local development, Supabase creates a
  // session immediately. In that case, send the new user straight to their
  // private dashboard instead of showing an unnecessary confirmation notice.
  if (data?.session) {
    redirect("/dashboard");
  }

  redirect(
    toMessageUrl(
      "/sign-up",
      "message",
      "Check your inbox to confirm your email address, then return here to sign in.",
    ),
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
