export const MIN_ASSESSMENT_QUESTION_COUNT = 3;
export const MAX_ASSESSMENT_QUESTION_COUNT = 10;
export const OPENAI_ASSESSMENT_MODEL = "gpt-5.6";

export type AssessmentType = "multiple_choice_test" | "worksheet";
export type AssessmentLevel = "Foundational" | "Standard" | "Challenge";
export type AssessmentQuestionType = "multiple_choice" | "short_answer";

export type AssessmentSourcePassage = {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  heading: string | null;
  content: string;
};

export type AssessmentCitation = {
  sourceChunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  heading: string | null;
  excerpt: string;
};

export type AssessmentQuestionDraft = {
  prompt: string;
  questionType: AssessmentQuestionType;
  options: string[];
  correctAnswer: string;
  explanation: string;
  citations: AssessmentCitation[];
};

export type AssessmentDraft = {
  title: string;
  directions: string;
  questions: AssessmentQuestionDraft[];
};

export type AssessmentGenerationInput = {
  type: AssessmentType;
  topicFocus: string;
  questionCount: number;
  level: AssessmentLevel;
  passages: AssessmentSourcePassage[];
};

export type AssessmentGenerationMode = "openai" | "mock";

export type OpenAiAssessmentClient = {
  responses: {
    create: (input: {
      model: string;
      input: Array<{ role: "system" | "user"; content: string }>;
      text: {
        format: {
          type: "json_schema";
          name: string;
          strict: true;
          schema: typeof assessmentStructuredOutputSchema;
        };
      };
    }) => Promise<{ output_text: string }>;
  };
};

type OpenAiRawQuestion = {
  prompt: unknown;
  question_type: unknown;
  options: unknown;
  correct_answer: unknown;
  explanation: unknown;
  citation_indexes: unknown;
};

type OpenAiRawAssessment = {
  title: unknown;
  directions: unknown;
  questions: unknown;
};

export class AssessmentGenerationError extends Error {
  constructor(message = "The assessment could not be generated from those sources.") {
    super(message);
    this.name = "AssessmentGenerationError";
  }
}

export function resolveAssessmentGenerationMode(
  configuredMode: string | undefined,
  environment: string | undefined,
): AssessmentGenerationMode {
  if (!configuredMode && environment === "development") {
    return "mock";
  }

  if (!configuredMode) {
    return "openai";
  }

  if (configuredMode === "mock" && environment === "development") {
    return "mock";
  }

  if (configuredMode === "mock") {
    throw new AssessmentGenerationError(
      "Mock assessment generation is available only during local development.",
    );
  }

  if (configuredMode === "openai") {
    return "openai";
  }

  throw new AssessmentGenerationError(
    "AI_ASSESSMENT_MODE must be omitted, openai, or mock for local development.",
  );
}

function cleanText(value: string, maximumLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximumLength);
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function sourceCitation(passage: AssessmentSourcePassage): AssessmentCitation {
  return {
    sourceChunkId: passage.id,
    documentId: passage.documentId,
    documentTitle: passage.documentTitle,
    pageNumber: passage.pageNumber,
    heading: passage.heading,
    excerpt: cleanText(passage.content, 480),
  };
}

function sourceSentence(passage: AssessmentSourcePassage) {
  const sentence = cleanText(passage.content, 700).match(/^.*?[.!?](?:\s|$)/)?.[0];
  return cleanText(sentence ?? passage.content, 420);
}

function validateGenerationInput(input: AssessmentGenerationInput) {
  if (input.type !== "multiple_choice_test" && input.type !== "worksheet") {
    throw new AssessmentGenerationError("Choose a worksheet or multiple-choice test.");
  }

  if (!Number.isInteger(input.questionCount) || input.questionCount < MIN_ASSESSMENT_QUESTION_COUNT || input.questionCount > MAX_ASSESSMENT_QUESTION_COUNT) {
    throw new AssessmentGenerationError(
      `Choose between ${MIN_ASSESSMENT_QUESTION_COUNT} and ${MAX_ASSESSMENT_QUESTION_COUNT} questions.`,
    );
  }

  if (!(["Foundational", "Standard", "Challenge"] as string[]).includes(input.level)) {
    throw new AssessmentGenerationError("Choose a valid assessment level.");
  }

  const passages = input.passages.filter(
    (passage) =>
      passage &&
      typeof passage.documentId === "string" &&
      typeof passage.documentTitle === "string" &&
      typeof passage.content === "string" &&
      passage.content.trim(),
  );

  if (passages.length === 0) {
    throw new AssessmentGenerationError("Choose material with citation-ready source passages.");
  }

  return {
    ...input,
    topicFocus: cleanText(input.topicFocus, 240),
    passages,
  };
}

function validateQuestion(question: AssessmentQuestionDraft, type: AssessmentType) {
  if (!question.prompt || !question.correctAnswer || question.citations.length === 0) {
    throw new AssessmentGenerationError();
  }

  if (type === "multiple_choice_test") {
    if (
      question.questionType !== "multiple_choice" ||
      question.options.length !== 4 ||
      !question.options.includes(question.correctAnswer)
    ) {
      throw new AssessmentGenerationError();
    }
  } else if (question.questionType !== "short_answer" || question.options.length > 0) {
    throw new AssessmentGenerationError();
  }
}

export function createMockAssessment(input: AssessmentGenerationInput): AssessmentDraft {
  const validated = validateGenerationInput(input);
  const label = validated.topicFocus || "Course material";
  const typeLabel = validated.type === "worksheet" ? "worksheet" : "multiple-choice test";
  const directions =
    validated.type === "worksheet"
      ? `Answer each question using complete ideas. Use details from the course material where appropriate.`
      : `Choose the best answer for each question.`;

  const questions = Array.from({ length: validated.questionCount }, (_, index) => {
    const passage = validated.passages[index % validated.passages.length];
    const statement = sourceSentence(passage);
    const citation = sourceCitation(passage);

    if (validated.type === "worksheet") {
      return {
        prompt: `In your own words, explain this idea from ${passage.heading ?? passage.documentTitle}: ${statement}`,
        questionType: "short_answer" as const,
        options: [],
        correctAnswer: `A strong response accurately explains: ${statement}`,
        explanation: `Review the cited passage and look for the main idea and supporting details.`,
        citations: [citation],
      };
    }

    const options = [
      statement,
      "The source says this topic has no important role.",
      "The source states that this idea is unrelated to the course material.",
      "The source explains that this process never affects anything else.",
    ];
    const correctIndex = index % options.length;
    const orderedOptions = [...options.slice(correctIndex), ...options.slice(0, correctIndex)];

    return {
      prompt: `According to the cited source, which statement is directly supported about ${passage.heading ?? label}?`,
      questionType: "multiple_choice" as const,
      options: orderedOptions,
      correctAnswer: statement,
      explanation: `The cited passage directly supports this statement: ${statement}`,
      citations: [citation],
    };
  });

  questions.forEach((question) => validateQuestion(question, validated.type));

  return {
    title: `${capitalize(label)} ${typeLabel}`,
    directions,
    questions,
  };
}

function mapCitationIndexes(indexes: unknown, passages: AssessmentSourcePassage[]) {
  if (!Array.isArray(indexes) || indexes.length === 0 || indexes.length > 3) {
    throw new AssessmentGenerationError();
  }

  const uniqueIndexes = [...new Set(indexes)];

  if (uniqueIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= passages.length)) {
    throw new AssessmentGenerationError();
  }

  return uniqueIndexes.map((index) => sourceCitation(passages[index]));
}

/**
 * Parses the future Structured Outputs response and replaces citation indexes
 * with the application's own retrieved source metadata. A model never gets to
 * invent document names, page numbers, or excerpts.
 */
export function parseOpenAiAssessmentOutput(
  outputText: string,
  input: Pick<AssessmentGenerationInput, "type" | "questionCount" | "passages">,
): AssessmentDraft {
  let parsed: OpenAiRawAssessment;

  try {
    parsed = JSON.parse(outputText) as OpenAiRawAssessment;
  } catch {
    throw new AssessmentGenerationError("The AI response was not a valid assessment.");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questions)) {
    throw new AssessmentGenerationError("The AI response was not a valid assessment.");
  }

  const title = typeof parsed.title === "string" ? cleanText(parsed.title, 160) : "";
  const directions = typeof parsed.directions === "string" ? cleanText(parsed.directions, 1_000) : "";

  if (!title || !directions || parsed.questions.length !== input.questionCount) {
    throw new AssessmentGenerationError("The AI response was not a complete assessment.");
  }

  const questions = parsed.questions.map((value) => {
    const question = value as OpenAiRawQuestion;
    const prompt = typeof question.prompt === "string" ? cleanText(question.prompt, 1_500) : "";
    const correctAnswer =
      typeof question.correct_answer === "string" ? cleanText(question.correct_answer, 1_000) : "";
    const explanation =
      typeof question.explanation === "string" ? cleanText(question.explanation, 1_500) : "";
    const questionType = question.question_type;
    const options = Array.isArray(question.options)
      ? question.options.map((option) => (typeof option === "string" ? cleanText(option, 600) : ""))
      : [];

    if (
      !prompt ||
      !correctAnswer ||
      !explanation ||
      (questionType !== "multiple_choice" && questionType !== "short_answer") ||
      options.some((option) => !option)
    ) {
      throw new AssessmentGenerationError("The AI response contained an invalid question.");
    }

    const draft: AssessmentQuestionDraft = {
      prompt,
      questionType,
      options,
      correctAnswer,
      explanation,
      citations: mapCitationIndexes(question.citation_indexes, input.passages),
    };
    validateQuestion(draft, input.type);
    return draft;
  });

  return { title, directions, questions };
}

export const assessmentStructuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "directions", "questions"],
  properties: {
    title: { type: "string" },
    directions: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "prompt",
          "question_type",
          "options",
          "correct_answer",
          "explanation",
          "citation_indexes",
        ],
        properties: {
          prompt: { type: "string" },
          question_type: { type: "string", enum: ["multiple_choice", "short_answer"] },
          options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          explanation: { type: "string" },
          citation_indexes: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
} as const;

export function buildOpenAiAssessmentPrompt(input: AssessmentGenerationInput) {
  const validated = validateGenerationInput(input);
  const sourceText = validated.passages
    .map(
      (passage, index) =>
        `[Source ${index}] ${passage.documentTitle}${passage.pageNumber ? `, page ${passage.pageNumber}` : ""}${passage.heading ? `, ${passage.heading}` : ""}\n${cleanText(passage.content, 1_200)}`,
    )
    .join("\n\n");

  return [
    `Create exactly ${validated.questionCount} ${validated.type === "worksheet" ? "short-answer worksheet" : "multiple-choice test"} questions at the ${validated.level} level.`,
    "Use only the supplied sources. Cite each question with one or more source indexes. Do not invent source details.",
    validated.topicFocus ? `Topic focus: ${validated.topicFocus}` : "Topic focus: use the selected sources broadly.",
    "For multiple-choice questions, provide exactly four options and make correct_answer exactly match one option. For worksheets, use short_answer and an empty options array.",
    "\nSources:\n" + sourceText,
  ].join("\n");
}

/**
 * Future paid mode. Structured Outputs constrains the response format, then
 * local validation replaces source indexes with trusted citation data.
 */
export async function generateOpenAiAssessment(
  client: OpenAiAssessmentClient,
  input: AssessmentGenerationInput,
  model = OPENAI_ASSESSMENT_MODEL,
) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You create accurate, teacher-reviewable assessments. Use only supplied sources and return the required JSON assessment.",
      },
      { role: "user", content: buildOpenAiAssessmentPrompt(input) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "assessment",
        strict: true,
        schema: assessmentStructuredOutputSchema,
      },
    },
  });

  return parseOpenAiAssessmentOutput(response.output_text, input);
}
