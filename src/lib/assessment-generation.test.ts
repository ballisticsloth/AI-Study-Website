import { describe, expect, it } from "vitest";

import {
  AssessmentGenerationError,
  createMockAssessment,
  generateOpenAiAssessment,
  parseOpenAiAssessmentOutput,
  resolveAssessmentGenerationMode,
} from "./assessment-generation";

const passages = [
  {
    id: "a8c1b6c0-2472-42af-8ced-f4b2b2ddf571",
    documentId: "93ff1c6b-a92a-43af-91e8-8e02241d03c4",
    documentTitle: "Cell Structure Notes",
    pageNumber: 2,
    heading: "Cell membrane",
    content: "The cell membrane controls what enters and leaves the cell. It helps maintain a stable internal environment.",
  },
  {
    id: "0d7a4550-422d-42c2-96db-5f360366a9fd",
    documentId: "b16af840-6a3a-48b4-9c0b-1d73e32b1cc1",
    documentTitle: "Cell Structure Notes",
    pageNumber: 3,
    heading: "Nucleus",
    content: "The nucleus contains genetic material and directs many activities of the cell.",
  },
];

describe("createMockAssessment", () => {
  it("creates cited, editable multiple-choice questions from selected source passages", () => {
    const assessment = createMockAssessment({
      type: "multiple_choice_test",
      topicFocus: "cell structure",
      questionCount: 3,
      level: "Standard",
      passages,
    });

    expect(assessment.title).toContain("Cell structure");
    expect(assessment.questions).toHaveLength(3);
    expect(assessment.questions[0]).toMatchObject({
      questionType: "multiple_choice",
      citations: [
        {
          documentTitle: "Cell Structure Notes",
          pageNumber: 2,
          heading: "Cell membrane",
        },
      ],
    });
    expect(assessment.questions[0].options).toContain(assessment.questions[0].correctAnswer);
  });

  it("creates short-answer worksheet prompts", () => {
    const assessment = createMockAssessment({
      type: "worksheet",
      topicFocus: "",
      questionCount: 3,
      level: "Foundational",
      passages,
    });

    expect(assessment.questions.every((question) => question.questionType === "short_answer")).toBe(
      true,
    );
    expect(assessment.questions.every((question) => question.options.length === 0)).toBe(true);
  });

  it("rejects unsupported generation settings before creating a draft", () => {
    expect(() =>
      createMockAssessment({
        type: "worksheet",
        topicFocus: "Cells",
        questionCount: 2,
        level: "Standard",
        passages,
      }),
    ).toThrow(AssessmentGenerationError);
  });
});

describe("parseOpenAiAssessmentOutput", () => {
  it("maps model citation indexes to the real retrieved source instead of trusting invented citation text", () => {
    const draft = parseOpenAiAssessmentOutput(
      JSON.stringify({
        title: "Cells check",
        directions: "Choose the best answer.",
        questions: [
          {
            prompt: "What does the cell membrane do?",
            question_type: "multiple_choice",
            options: ["Controls entry and exit", "Stores sunlight", "Builds bones", "Makes weather"],
            correct_answer: "Controls entry and exit",
            explanation: "The passage says it controls entry and exit.",
            citation_indexes: [0],
          },
        ],
      }),
      { type: "multiple_choice_test", questionCount: 1, passages: [passages[0]] },
    );

    expect(draft.questions[0].citations).toEqual([
      expect.objectContaining({
        sourceChunkId: passages[0].id,
        documentId: passages[0].documentId,
        documentTitle: "Cell Structure Notes",
        excerpt: passages[0].content,
      }),
    ]);
  });
});

describe("assessment generation providers", () => {
  it("allows mock generation only in local development", () => {
    expect(resolveAssessmentGenerationMode("mock", "development")).toBe("mock");
    expect(resolveAssessmentGenerationMode(undefined, "development")).toBe("mock");
    expect(() => resolveAssessmentGenerationMode("mock", "production")).toThrow(
      "Mock assessment generation is available only during local development",
    );
  });

  it("prepares a strict structured-output request for the future OpenAI mode", async () => {
    const create = async () => ({
      output_text: JSON.stringify({
        title: "Cells check",
        directions: "Choose the best answer.",
        questions: Array.from({ length: 3 }, () => ({
          prompt: "What does the cell membrane do?",
          question_type: "multiple_choice",
          options: ["Controls entry and exit", "Stores sunlight", "Builds bones", "Makes weather"],
          correct_answer: "Controls entry and exit",
          explanation: "The passage says it controls entry and exit.",
          citation_indexes: [0],
        })),
      }),
    });

    const assessment = await generateOpenAiAssessment(
      { responses: { create } },
      {
        type: "multiple_choice_test",
        topicFocus: "cell membrane",
        questionCount: 3,
        level: "Standard",
        passages: [passages[0]],
      },
    );

    expect(assessment.questions[0].citations[0].documentId).toBe(passages[0].documentId);
  });
});
