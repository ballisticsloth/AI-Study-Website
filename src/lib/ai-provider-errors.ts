function recordFromUnknown(error: unknown) {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : null;
}

export function getAiProviderErrorCode(error: unknown) {
  const value = recordFromUnknown(error)?.code;
  return typeof value === "string" ? value : null;
}

/** Returns a safe, actionable message without exposing a provider response. */
export function getAiProviderErrorMessage(error: unknown) {
  const record = recordFromUnknown(error);
  if (record?.status !== 429) return null;

  const code = getAiProviderErrorCode(error)?.toLowerCase() ?? "";
  const providerMessage = typeof record?.message === "string" ? record.message.toLowerCase() : "";
  const hasSpendLimitSignal = /quota|credit|billing|spend|usage.?limit/.test(`${code} ${providerMessage}`);

  if (hasSpendLimitSignal) {
    return "The AI service has reached its pre-alpha spending limit or is out of credits. Please try again later.";
  }

  return "The AI service is temporarily busy. Please wait a minute and try again.";
}
