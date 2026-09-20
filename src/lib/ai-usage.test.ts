import { describe, expect, it } from "vitest";

import {
  DAILY_ASSESSMENT_GENERATION_LIMIT,
  DAILY_TUTOR_MESSAGE_LIMIT,
  estimateOpenAiCostUsd,
  readOpenAiUsage,
} from "./ai-usage";

describe("AI usage safeguards", () => {
  it("defines the pre-alpha daily limits", () => {
    expect(DAILY_ASSESSMENT_GENERATION_LIMIT).toBe(5);
    expect(DAILY_TUTOR_MESSAGE_LIMIT).toBe(30);
  });

  it("reads provider token usage and estimates the configured model cost", () => {
    expect(readOpenAiUsage({ input_tokens: 1_500, output_tokens: 500 })).toEqual({
      inputTokens: 1_500,
      outputTokens: 500,
    });
    expect(estimateOpenAiCostUsd({ inputTokens: 1_500, outputTokens: 500 })).toBe(0.016);
  });

  it("treats missing provider usage as zero rather than inventing a cost", () => {
    expect(readOpenAiUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
