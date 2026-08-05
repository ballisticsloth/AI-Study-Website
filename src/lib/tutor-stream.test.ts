import { describe, expect, it } from "vitest";

import { createTutorEventStream, type TutorStreamEvent } from "./tutor-stream";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const item = await reader.read();
    if (item.done) return result;
    result += decoder.decode(item.value, { stream: true });
  }
}

describe("createTutorEventStream", () => {
  it("serializes tutor metadata and text deltas as separate newline-delimited events", async () => {
    const events: TutorStreamEvent[] = [
      { type: "assistant", messageId: "message-id", createdAt: "2026-08-05T00:00:00.000Z", grounding: "course_material", citations: [] },
      { type: "delta", value: "Try " },
      { type: "delta", value: "this." },
      { type: "done" },
    ];
    const text = await readStream(createTutorEventStream(events));

    expect(text.trim().split("\n").map((line) => JSON.parse(line))).toEqual(events);
  });
});
