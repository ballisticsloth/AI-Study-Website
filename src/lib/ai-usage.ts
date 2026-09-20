export const DAILY_ASSESSMENT_GENERATION_LIMIT = 5;
export const DAILY_TUTOR_MESSAGE_LIMIT = 30;

// These rates match the configured gpt-5.6 model at the time this pre-alpha
// safeguard was added. Update them together with the model configuration.
export const OPENAI_INPUT_COST_PER_MILLION_TOKENS_USD = 4;
export const OPENAI_OUTPUT_COST_PER_MILLION_TOKENS_USD = 20;

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Reads normalized Responses API usage without trusting invalid values. */
export function readOpenAiUsage(value: unknown): AiTokenUsage {
  if (!value || typeof value !== "object") return { inputTokens: 0, outputTokens: 0 };

  const usage = value as Record<string, unknown>;
  return {
    inputTokens: nonNegativeInteger(usage.input_tokens),
    outputTokens: nonNegativeInteger(usage.output_tokens),
  };
}

/** A transparent estimate; provider billing remains the source of truth. */
export function estimateOpenAiCostUsd(usage: AiTokenUsage) {
  const estimate =
    (usage.inputTokens / 1_000_000) * OPENAI_INPUT_COST_PER_MILLION_TOKENS_USD +
    (usage.outputTokens / 1_000_000) * OPENAI_OUTPUT_COST_PER_MILLION_TOKENS_USD;

  return Math.round(estimate * 100_000_000) / 100_000_000;
}
