import "server-only";

import { createClient } from "@supabase/supabase-js";

class SupabaseAdminConfigurationError extends Error {
  constructor() {
    super("Document processing is not configured.");
  }
}

export function isDocumentProcessingConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export function createAdminClient() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase secret keys are preferred. The legacy service-role key remains a
  // supported local-development fallback for projects created before secret
  // keys were available.
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serverKey) {
    throw new SupabaseAdminConfigurationError();
  }

  return createClient(projectUrl, serverKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export { SupabaseAdminConfigurationError };
