export const EMBEDDING_DIMENSIONS = 1_536;

/**
 * Converts a validated OpenAI embedding into the literal input format accepted
 * by pgvector through Supabase's RPC interface.
 */
export function embeddingToPgVector(embedding: readonly number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `An embedding must contain exactly ${EMBEDDING_DIMENSIONS} dimensions.`,
    );
  }

  if (!embedding.every(Number.isFinite)) {
    throw new Error("An embedding must contain only finite numbers.");
  }

  return `[${embedding.join(",")}]`;
}
