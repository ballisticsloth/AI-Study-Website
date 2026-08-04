import { describe, expect, it } from "vitest";

import { parseAssessmentCitation, parseAssessmentQuestion } from "./assessments";

describe("assessment persistence parsing", () => {
  it("keeps only complete, displayable citations", () => {
    expect(
      parseAssessmentCitation({
        sourceChunkId: "a8c1b6c0-2472-42af-8ced-f4b2b2ddf571",
        documentId: "93ff1c6b-a92a-43af-91e8-8e02241d03c4",
        documentTitle: "Cell Structure Notes",
        pageNumber: 2,
        heading: "Cell membrane",
        excerpt: "The cell membrane controls what enters and leaves the cell.",
      }),
    ).toMatchObject({ documentTitle: "Cell Structure Notes", pageNumber: 2 });
  });

  it("rejects malformed stored questions", () => {
    expect(() =>
      parseAssessmentQuestion({
        id: "not-a-uuid",
        prompt: "",
        question_type: "multiple_choice",
        options: [],
        correct_answer: "",
        explanation: "",
        citations: [],
      }),
    ).toThrow("stored assessment question");
  });
});
