import type { TutorCitation } from "./tutor-generation";

export type TutorStreamEvent =
  | {
      type: "conversation";
      conversation: {
        id: string;
        courseId: string;
        sourceDocumentIds: string[];
        title: string;
        createdAt: string;
        updatedAt: string;
      };
    }
  | {
      type: "assistant";
      messageId: string;
      createdAt: string;
      grounding: "course_material" | "general_knowledge";
      citations: TutorCitation[];
      generationMode?: "mock" | "openai";
    }
  | { type: "delta"; value: string }
  | { type: "done" }
  | { type: "error"; message: string };

function splitForStreaming(content: string) {
  return content.match(/.{1,72}(?:\s|$)|\S+?\s*/g) ?? [content];
}

/** Streams NDJSON so the browser can render tutor text as it arrives. */
export function createTutorEventStream(events: TutorStreamEvent[]) {
  const encoder = new TextEncoder();
  const expandedEvents: TutorStreamEvent[] = [];
  for (const event of events) {
    if (event.type === "delta") {
      expandedEvents.push(
        ...splitForStreaming(event.value).map((value) => ({ type: "delta" as const, value })),
      );
    } else {
      expandedEvents.push(event);
    }
  }
  let cursor = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const event = expandedEvents[cursor++];
      if (!event) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
  });
}
