import { describe, expect, it } from "vitest";

import {
  TutorGenerationError,
  createMockTutorReply,
  parseOpenAiTutorOutput,
  resolveTutorGenerationMode,
} from "./tutor-generation";

const passages = [
  {
    id: "a8c1b6c0-2472-42af-8ced-f4b2b2ddf571",
    documentId: "93ff1c6b-a92a-43af-91e8-8e02241d03c4",
    documentTitle: "Cell Structure Notes",
    pageNumber: 2,
    heading: "Cell membrane",
    content: "The cell membrane controls what enters and leaves the cell. It helps maintain a stable internal environment.",
  },
];

describe("createMockTutorReply", () => {
  it("starts with a source-grounded hint and a check for understanding", () => {
    const reply = createMockTutorReply({
      question: "What does the cell membrane do?",
      passages,
      hasPriorAssistantReply: false,
    });

    expect(reply.grounding).toBe("course_material");
    expect(reply.citations).toEqual([
      expect.objectContaining({
        sourceChunkId: passages[0].id,
        documentTitle: "Cell Structure Notes",
        pageNumber: 2,
      }),
    ]);
    expect(reply.content).toContain("Before I explain it");
    expect(reply.content.toLowerCase()).toContain("what do you think");
    expect(reply.content).not.toContain("controls what enters and leaves the cell");
  });

  it("reveals a concise source-based explanation only after an earlier tutor turn", () => {
    const reply = createMockTutorReply({
      question: "Can you check my answer?",
      passages,
      hasPriorAssistantReply: true,
    });

    expect(reply.content).toContain("A concise explanation");
    expect(reply.content).toContain("controls what enters and leaves the cell");
  });

  it("labels an honest general-knowledge response when no selected source matches", () => {
    const reply = createMockTutorReply({
      question: "What is mitosis?",
      passages: [],
      hasPriorAssistantReply: false,
    });

    expect(reply).toMatchObject({ grounding: "general_knowledge", citations: [] });
    expect(reply.content).toContain("General-knowledge response");
  });
});

describe("OpenAI tutor response validation", () => {
  it("maps model citation indexes onto trusted retrieved passages", () => {
    const reply = parseOpenAiTutorOutput(
      JSON.stringify({
        reply: "Look at the source and describe what crosses the membrane.",
        grounding: "course_material",
        citation_indexes: [0],
      }),
      passages,
    );

    expect(reply.citations[0]).toMatchObject({
      sourceChunkId: passages[0].id,
      documentId: passages[0].documentId,
    });
  });

  it("rejects a sourced response without a valid trusted source index", () => {
    expect(() =>
      parseOpenAiTutorOutput(
        JSON.stringify({
          reply: "An answer",
          grounding: "course_material",
          citation_indexes: [3],
        }),
        passages,
      ),
    ).toThrow(TutorGenerationError);
  });

  it("keeps mock mode local to development", () => {
    expect(resolveTutorGenerationMode("mock", "development")).toBe("mock");
    expect(() => resolveTutorGenerationMode("mock", "production")).toThrow(
      "Mock tutor generation is available only during local development",
    );
  });
});
