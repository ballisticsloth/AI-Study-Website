import { describe, expect, it } from "vitest";

import { TutorRequestError, validateTutorMessageRequest } from "./tutor-request";

const courseId = "9ec17a67-498d-4942-b772-a56b6a993980";
const documentId = "93ff1c6b-a92a-43af-91e8-8e02241d03c4";

describe("validateTutorMessageRequest", () => {
  it("normalizes a bounded message and a unique explicit material scope", () => {
    expect(
      validateTutorMessageRequest({
        courseId,
        documentIds: [documentId, documentId],
        message: "  Help me understand membranes.  ",
      }),
    ).toEqual({
      conversationId: null,
      courseId,
      documentIds: [documentId],
      message: "Help me understand membranes.",
    });
  });

  it("requires a non-empty selected material scope", () => {
    expect(() =>
      validateTutorMessageRequest({ courseId, documentIds: [], message: "Help" }),
    ).toThrow(TutorRequestError);
  });

  it("rejects an invalid conversation id before any database query", () => {
    expect(() =>
      validateTutorMessageRequest({
        conversationId: "not-an-id",
        courseId,
        documentIds: [documentId],
        message: "Help",
      }),
    ).toThrow("valid tutor conversation");
  });
});
