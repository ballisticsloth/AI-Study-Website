import { describe, expect, it } from "vitest";

import { parseTutorConversation } from "./tutor";

const conversationId = "e743e10b-8c6d-474e-b7b4-9cf96257e601";
const courseId = "9ec17a67-498d-4942-b772-a56b6a993980";
const documentId = "93ff1c6b-a92a-43af-91e8-8e02241d03c4";

describe("parseTutorConversation", () => {
  it("keeps only a conversation's persisted course and material scope with its messages", () => {
    const conversation = parseTutorConversation({
      id: conversationId,
      course_id: courseId,
      title: "Cell membrane question",
      topic_focus: null,
      source_document_ids: [documentId],
      created_at: "2026-08-05T00:00:00.000Z",
      updated_at: "2026-08-05T00:01:00.000Z",
      tutor_messages: [
        {
          id: "67c32b6d-9c33-4881-8d8f-0169efae4e99",
          role: "assistant",
          content: "What do you think the source suggests?",
          citations: [
            {
              sourceChunkId: "a8c1b6c0-2472-42af-8ced-f4b2b2ddf571",
              documentId,
              documentTitle: "Cell Structure Notes",
              pageNumber: 2,
              heading: "Cell membrane",
              excerpt: "The cell membrane controls what enters and leaves the cell.",
            },
          ],
          created_at: "2026-08-05T00:01:00.000Z",
        },
      ],
    });

    expect(conversation).toMatchObject({
      id: conversationId,
      courseId,
      sourceDocumentIds: [documentId],
      messages: [expect.objectContaining({ role: "assistant" })],
    });
  });

  it("rejects malformed source scopes instead of exposing an ambiguous conversation", () => {
    expect(() =>
      parseTutorConversation({
        id: conversationId,
        course_id: courseId,
        title: "Question",
        topic_focus: null,
        source_document_ids: ["not-a-uuid"],
        created_at: "2026-08-05T00:00:00.000Z",
        updated_at: "2026-08-05T00:01:00.000Z",
        tutor_messages: [],
      }),
    ).toThrow("Invalid stored tutor conversation");
  });
});
