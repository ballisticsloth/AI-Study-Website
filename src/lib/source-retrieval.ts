import { embeddingToPgVector } from "./retrieval";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_SOURCE_SEARCH_QUERY_LENGTH = 1_000;
export const MAX_SOURCE_SEARCH_DOCUMENTS = 25;

export type SourceSearchInput = {
  courseId: string;
  documentIds: string[];
  query: string;
};

type SourceSearchRpcArguments = {
  p_course_id: string;
  p_document_ids: string[] | null;
  p_query_embedding: string;
  p_match_count: 6;
  p_match_threshold: 0.35;
};

export class SourceSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceSearchInputError";
  }
}

function isValidUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Validates the only client-controlled parts of a source search and creates
 * the constrained RPC argument shape. The signed-in user is deliberately not
 * an input: the server action derives it from the current session.
 */
export function validateSourceSearchInput(input: unknown): {
  courseId: string;
  documentIds: string[];
  query: string;
} {
  if (!input || typeof input !== "object") {
    throw new SourceSearchInputError("Choose a course before searching your sources.");
  }

  const candidate = input as Partial<SourceSearchInput>;

  if (typeof candidate.courseId !== "string" || !isValidUuid(candidate.courseId)) {
    throw new SourceSearchInputError("Choose a valid course before searching your sources.");
  }

  if (typeof candidate.query !== "string") {
    throw new SourceSearchInputError("Enter a question or topic to search your sources.");
  }

  const query = cleanQuery(candidate.query);

  if (!query) {
    throw new SourceSearchInputError("Enter a question or topic to search your sources.");
  }

  if (query.length > MAX_SOURCE_SEARCH_QUERY_LENGTH) {
    throw new SourceSearchInputError(
      `Keep source searches to ${MAX_SOURCE_SEARCH_QUERY_LENGTH} characters or fewer.`,
    );
  }

  if (!Array.isArray(candidate.documentIds)) {
    throw new SourceSearchInputError("Choose valid materials before searching your sources.");
  }

  const documentIds = [...new Set(candidate.documentIds)];

  if (
    documentIds.length > MAX_SOURCE_SEARCH_DOCUMENTS ||
    documentIds.some((documentId) => !isValidUuid(documentId))
  ) {
    throw new SourceSearchInputError("Choose valid materials before searching your sources.");
  }

  return { courseId: candidate.courseId, documentIds, query };
}

export function prepareSourceSearch(
  input: SourceSearchInput,
  queryEmbedding: readonly number[],
): { query: string; rpcArguments: SourceSearchRpcArguments } {
  const validatedInput = validateSourceSearchInput(input);

  return {
    query: validatedInput.query,
    rpcArguments: {
      p_course_id: validatedInput.courseId,
      p_document_ids:
        validatedInput.documentIds.length > 0 ? validatedInput.documentIds : null,
      p_query_embedding: embeddingToPgVector(queryEmbedding),
      p_match_count: 6,
      p_match_threshold: 0.35,
    },
  };
}
