import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for Client Components and browser-only code.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
