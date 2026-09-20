import "server-only";

import {
  estimateOpenAiCostUsd,
  type AiTokenUsage,
} from "@/lib/ai-usage";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiUsageFeature = "assessment_generation" | "tutor_message";
export type AiUsageGenerationMode = "mock" | "openai";
export type AiUsageReservation = { usageEventId: string } | { error: string };

type RpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

function dailyLimitMessage(feature: AiUsageFeature) {
  return feature === "assessment_generation"
    ? "You have reached today’s limit of 5 assessment generations. Try again after midnight UTC."
    : "You have reached today’s limit of 30 tutor messages. Try again after midnight UTC.";
}

export async function reserveAiUsage(
  client: RpcClient,
  input: { feature: AiUsageFeature; model: string; generationMode: AiUsageGenerationMode },
): Promise<AiUsageReservation> {
  const { data, error } = await client.rpc("reserve_ai_usage", {
    p_feature: input.feature,
    p_model: input.model,
    p_generation_mode: input.generationMode,
  });

  if (error) {
    if (error.message?.includes("daily_ai_usage_limit_reached")) {
      return { error: dailyLimitMessage(input.feature) };
    }
    return { error: "We could not check your daily AI limit. Please try again." };
  }

  if (typeof data !== "string") {
    return { error: "We could not reserve your AI request. Please try again." };
  }

  return { usageEventId: data };
}

/** Best-effort server-only completion. A logging failure never hides a usable result. */
export async function completeAiUsage(input: {
  usageEventId: string;
  status: "completed" | "failed";
  generationMode: AiUsageGenerationMode;
  usage?: AiTokenUsage;
  providerErrorCode?: string | null;
}) {
  const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
  const estimatedCostUsd = input.generationMode === "openai" ? estimateOpenAiCostUsd(usage) : 0;

  try {
    await createAdminClient().rpc("complete_ai_usage", {
      p_usage_event_id: input.usageEventId,
      p_status: input.status,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_estimated_cost_usd: estimatedCostUsd,
      p_provider_error_code: input.providerErrorCode ?? null,
    });
  } catch {
    // The feature operation already succeeded or has its own user-facing error.
  }
}
