import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS } from "./retrieval";
import {
  prepareMockTextSearch,
  SourceSearchInputError,
  prepareSourceSearch,
} from "./source-retrieval";

const courseId = "9ec17a67-498d-4942-b772-a56b6a993980";
const firstDocumentId = "d3127676-0f52-4f24-a4f4-b71903bcb55d";
const secondDocumentId = "09388a55-070f-401b-a91c-35bb637fdc13";
const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);

describe("prepareSourceSearch", () => {
  it("keeps retrieval within the requested course and selected documents", () => {
    expect(
      prepareSourceSearch(
        {
          courseId,
          documentIds: [firstDocumentId, secondDocumentId, firstDocumentId],
          query: "  Explain the first law of thermodynamics.  ",
        },
        embedding,
      ),
    ).toEqual({
      query: "Explain the first law of thermodynamics.",
      rpcArguments: {
        p_course_id: courseId,
        p_document_ids: [firstDocumentId, secondDocumentId],
        p_query_embedding: expect.stringMatching(/^\[0\.25,0\.25,/),
        p_match_count: 6,
        p_match_threshold: 0.35,
      },
    });
  });

  it("searches all ready material only when no document is selected", () => {
    expect(
      prepareSourceSearch(
        { courseId, documentIds: [], query: "Chemical reactions" },
        embedding,
      ).rpcArguments.p_document_ids,
    ).toBeNull();
  });

  it("uses exact text search arguments for local mock mode", () => {
    expect(
      prepareMockTextSearch({
        courseId,
        documentIds: [firstDocumentId, firstDocumentId],
        query: "  Cell structure  ",
      }),
    ).toEqual({
      p_course_id: courseId,
      p_document_ids: [firstDocumentId],
      p_query: "Cell structure",
      p_match_count: 6,
    });
  });

  it("rejects malformed IDs and blank queries before an embedding is generated", () => {
    expect(() =>
      prepareSourceSearch(
        { courseId: "not-a-uuid", documentIds: [], query: "Question" },
        embedding,
      ),
    ).toThrow(SourceSearchInputError);

    expect(() =>
      prepareSourceSearch(
        { courseId, documentIds: ["not-a-uuid"], query: "Question" },
        embedding,
      ),
    ).toThrow(SourceSearchInputError);

    expect(() =>
      prepareSourceSearch({ courseId, documentIds: [], query: "   " }, embedding),
    ).toThrow("Enter a question or topic to search your sources.");
  });
});
