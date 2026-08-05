import type { TutorCitation } from "./tutor-generation";

export type TutorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: TutorCitation[];
  createdAt: string;
};

export type TutorConversation = {
  id: string;
  courseId: string | null;
  title: string;
  topicFocus: string | null;
  sourceDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
  messages: TutorMessage[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength) : "";
}

export function parseTutorCitation(value: unknown): TutorCitation {
  if (!value || typeof value !== "object") throw new Error("Invalid stored tutor citation.");
  const citation = value as Record<string, unknown>;
  const documentTitle = cleanText(citation.documentTitle, 255);
  const excerpt = cleanText(citation.excerpt, 1_000);
  if (
    !isUuid(citation.sourceChunkId) ||
    !isUuid(citation.documentId) ||
    !documentTitle ||
    !excerpt ||
    (citation.pageNumber !== null && !Number.isInteger(citation.pageNumber)) ||
    (citation.heading !== null && typeof citation.heading !== "string")
  ) {
    throw new Error("Invalid stored tutor citation.");
  }
  return {
    sourceChunkId: citation.sourceChunkId,
    documentId: citation.documentId,
    documentTitle,
    pageNumber: citation.pageNumber as number | null,
    heading: citation.heading === null ? null : cleanText(citation.heading, 255),
    excerpt,
  };
}

export function parseTutorMessage(value: unknown): TutorMessage {
  if (!value || typeof value !== "object") throw new Error("Invalid stored tutor message.");
  const message = value as Record<string, unknown>;
  const content = cleanText(message.content, 4_000);
  const citations = Array.isArray(message.citations) ? message.citations.map(parseTutorCitation) : [];
  if (
    !isUuid(message.id) ||
    (message.role !== "user" && message.role !== "assistant") ||
    !content ||
    typeof message.created_at !== "string"
  ) {
    throw new Error("Invalid stored tutor message.");
  }
  return { id: message.id, role: message.role, content, citations, createdAt: message.created_at };
}

export function parseTutorConversation(value: unknown): TutorConversation {
  if (!value || typeof value !== "object") throw new Error("Invalid stored tutor conversation.");
  const conversation = value as Record<string, unknown>;
  const title = cleanText(conversation.title, 160);
  const sourceDocumentIds = Array.isArray(conversation.source_document_ids)
    ? [...new Set(conversation.source_document_ids)]
    : [];
  const messages = Array.isArray(conversation.tutor_messages)
    ? conversation.tutor_messages.map(parseTutorMessage)
    : [];
  if (
    !isUuid(conversation.id) ||
    (conversation.course_id !== null && !isUuid(conversation.course_id)) ||
    !title ||
    !sourceDocumentIds.every(isUuid) ||
    typeof conversation.created_at !== "string" ||
    typeof conversation.updated_at !== "string"
  ) {
    throw new Error("Invalid stored tutor conversation.");
  }
  return {
    id: conversation.id,
    courseId: conversation.course_id,
    title,
    topicFocus: typeof conversation.topic_focus === "string" ? cleanText(conversation.topic_focus, 240) : null,
    sourceDocumentIds,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages: messages.sort((first, second) => first.createdAt.localeCompare(second.createdAt)),
  };
}
