import { describe, expect, it } from "vitest";

import { getAiProviderErrorMessage, getAiProviderErrorCode } from "./ai-provider-errors";

describe("AI provider errors", () => {
  it("hides an exhausted-credit or spend-limit 429 behind a helpful message", () => {
    const error = { status: 429, code: "insufficient_quota", message: "You exceeded your current quota." };

    expect(getAiProviderErrorCode(error)).toBe("insufficient_quota");
    expect(getAiProviderErrorMessage(error)).toContain("pre-alpha spending limit");
  });

  it("gives a retry message for a temporary 429 rate limit", () => {
    expect(getAiProviderErrorMessage({ status: 429, code: "rate_limit_exceeded" })).toContain(
      "temporarily busy",
    );
  });

  it("does not replace unrelated errors", () => {
    expect(getAiProviderErrorMessage({ status: 500, message: "Internal error" })).toBeNull();
  });
});
