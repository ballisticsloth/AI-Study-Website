import type {
  AssessmentCitation,
  AssessmentLevel,
  AssessmentQuestionType,
  AssessmentType,
} from "./assessment-generation";

export type SavedAssessmentQuestion = {
  id: string;
  prompt: string;
  questionType: AssessmentQuestionType;
  options: string[];
  correctAnswer: string;
  explanation: string;
  citations: AssessmentCitation[];
};

export type SavedAssessment = {
  id: string;
  courseId: string | null;
  type: AssessmentType;
  title: string;
  directions: string;
  topicFocus: string;
  level: AssessmentLevel;
  questionCount: number;
  generationMode: "mock" | "openai";
  sourceDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
  questions: SavedAssessmentQuestion[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: string, maximumLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximumLength);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isAssessmentLevel(value: unknown): value is AssessmentLevel {
  return value === "Foundational" || value === "Standard" || value === "Challenge";
}

export function parseAssessmentCitation(value: unknown): AssessmentCitation {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid stored assessment citation.");
  }

  const citation = value as Record<string, unknown>;

  if (
    !isUuid(citation.sourceChunkId) ||
    !isUuid(citation.documentId) ||
    typeof citation.documentTitle !== "string" ||
    !cleanText(citation.documentTitle, 255) ||
    (citation.pageNumber !== null && !Number.isInteger(citation.pageNumber)) ||
    (citation.heading !== null && typeof citation.heading !== "string") ||
    typeof citation.excerpt !== "string" ||
    !cleanText(citation.excerpt, 1_000)
  ) {
    throw new Error("Invalid stored assessment citation.");
  }

  return {
    sourceChunkId: citation.sourceChunkId,
    documentId: citation.documentId,
    documentTitle: cleanText(citation.documentTitle, 255),
    pageNumber: citation.pageNumber as number | null,
    heading: citation.heading === null ? null : cleanText(citation.heading, 255),
    excerpt: cleanText(citation.excerpt, 1_000),
  };
}

export function parseAssessmentQuestion(value: unknown): SavedAssessmentQuestion {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid stored assessment question.");
  }

  const question = value as Record<string, unknown>;
  const options = Array.isArray(question.options)
    ? question.options.map((option) => (typeof option === "string" ? cleanText(option, 600) : ""))
    : [];
  const citations = Array.isArray(question.citations)
    ? question.citations.map(parseAssessmentCitation)
    : [];

  if (
    !isUuid(question.id) ||
    typeof question.prompt !== "string" ||
    !cleanText(question.prompt, 1_500) ||
    (question.question_type !== "multiple_choice" && question.question_type !== "short_answer") ||
    typeof question.correct_answer !== "string" ||
    !cleanText(question.correct_answer, 1_000) ||
    typeof question.explanation !== "string" ||
    citations.length === 0 ||
    options.some((option) => !option)
  ) {
    throw new Error("Invalid stored assessment question.");
  }

  return {
    id: question.id,
    prompt: cleanText(question.prompt, 1_500),
    questionType: question.question_type,
    options,
    correctAnswer: cleanText(question.correct_answer, 1_000),
    explanation: cleanText(question.explanation, 1_500),
    citations,
  };
}

export function parseSavedAssessment(value: unknown): SavedAssessment {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid stored assessment.");
  }

  const assessment = value as Record<string, unknown>;
  const settings =
    assessment.generation_settings && typeof assessment.generation_settings === "object"
      ? (assessment.generation_settings as Record<string, unknown>)
      : {};
  const questions = Array.isArray(assessment.material_questions)
    ? assessment.material_questions.map(parseAssessmentQuestion)
    : [];

  if (
    !isUuid(assessment.id) ||
    (assessment.course_id !== null && !isUuid(assessment.course_id)) ||
    (assessment.type !== "multiple_choice_test" && assessment.type !== "worksheet") ||
    typeof assessment.title !== "string" ||
    !cleanText(assessment.title, 160) ||
    typeof assessment.directions !== "string" ||
    !isAssessmentLevel(settings.level) ||
    !Number.isInteger(settings.questionCount) ||
    (settings.generationMode !== "mock" && settings.generationMode !== "openai") ||
    !Array.isArray(settings.documentIds) ||
    settings.documentIds.some((id) => !isUuid(id)) ||
    typeof assessment.created_at !== "string" ||
    typeof assessment.updated_at !== "string"
  ) {
    throw new Error("Invalid stored assessment.");
  }

  return {
    id: assessment.id,
    courseId: assessment.course_id,
    type: assessment.type,
    title: cleanText(assessment.title, 160),
    directions: cleanText(assessment.directions, 1_000),
    topicFocus: typeof settings.topicFocus === "string" ? cleanText(settings.topicFocus, 240) : "",
    level: settings.level as AssessmentLevel,
    questionCount: settings.questionCount as number,
    generationMode: settings.generationMode as "mock" | "openai",
    sourceDocumentIds: [...new Set(settings.documentIds as string[])],
    createdAt: assessment.created_at,
    updatedAt: assessment.updated_at,
    questions: questions.sort((first, second) => {
      const firstIndex = (assessment.material_questions as Array<Record<string, unknown>>).findIndex(
        (question) => question.id === first.id,
      );
      const secondIndex = (assessment.material_questions as Array<Record<string, unknown>>).findIndex(
        (question) => question.id === second.id,
      );
      return firstIndex - secondIndex;
    }),
  };
}
