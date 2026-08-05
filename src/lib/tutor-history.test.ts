import { describe, expect, it } from "vitest";

import { hasPriorGroundedTutorReply } from "./tutor-history";

describe("hasPriorGroundedTutorReply", () => {
  it("does not treat an earlier general-knowledge reply as a completed grounded tutor turn", () => {
    expect(
      hasPriorGroundedTutorReply([
        { role: "user", citations: [] },
        { role: "assistant", citations: [] },
      ]),
    ).toBe(false);
  });

  it("recognizes an earlier assistant reply only when it retained a source citation", () => {
    expect(
      hasPriorGroundedTutorReply([
        { role: "assistant", citations: [{ sourceChunkId: "source" }] },
      ]),
    ).toBe(true);
  });
});
