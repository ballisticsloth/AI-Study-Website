import { MAX_TUTOR_MESSAGE_LENGTH } from "./tutor-generation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_TUTOR_SOURCE_DOCUMENTS = 25;

export type TutorMessageRequest = {
  conversationId: string | null;
  courseId: string;
  documentIds: string[];
  message: string;
};

export class TutorRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorRequestError";
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Validates all browser-controlled fields before the server checks ownership. */
export function validateTutorMessageRequest(value: unknown): TutorMessageRequest {
  if (!value || typeof value !== "object") {
    throw new TutorRequestError("Send a tutor question with a course and selected sources.");
  }
  const input = value as Record<string, unknown>;
  const conversationId = input.conversationId === undefined || input.conversationId === null ? null : input.conversationId;
  if (conversationId !== null && !isUuid(conversationId)) {
    throw new TutorRequestError("Choose a valid tutor conversation.");
  }
  if (!isUuid(input.courseId)) throw new TutorRequestError("Choose a valid course before asking the tutor.");
  if (!Array.isArray(input.documentIds)) {
    throw new TutorRequestError("Choose at least one ready source for this conversation.");
  }
  const documentIds = [...new Set(input.documentIds)];
  if (
    documentIds.length === 0 ||
    documentIds.length > MAX_TUTOR_SOURCE_DOCUMENTS ||
    documentIds.some((documentId) => !isUuid(documentId))
  ) {
    throw new TutorRequestError("Choose at least one ready source for this conversation.");
  }
  const message = cleanText(input.message);
  if (!message) throw new TutorRequestError("Write a question or an idea you want to work through.");
  if (message.length > MAX_TUTOR_MESSAGE_LENGTH) {
    throw new TutorRequestError(`Keep tutor messages to ${MAX_TUTOR_MESSAGE_LENGTH} characters or fewer.`);
  }
  return { conversationId, courseId: input.courseId, documentIds, message };
}
