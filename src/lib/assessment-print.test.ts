import { describe, expect, it } from "vitest";

import { choiceLabel } from "./assessment-print";

describe("choiceLabel", () => {
  it("formats visible choice letters for print layouts", () => {
    expect(choiceLabel(0)).toBe("A.");
    expect(choiceLabel(3)).toBe("D.");
  });
});
