import { EMBEDDING_DIMENSIONS, embeddingToPgVector } from "./retrieval";

export const EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbeddingMode = "openai" | "mock";

type EmbeddingResponse = {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
};

export type EmbeddingsClient = {
  embeddings: {
    create: (input: {
      model: typeof EMBEDDING_MODEL;
      input: string[];
      encoding_format: "float";
    }) => Promise<EmbeddingResponse>;
  };
};

export class EmbeddingGenerationError extends Error {
  constructor(message = "The document could not be prepared for search.") {
    super(message);
    this.name = "EmbeddingGenerationError";
  }
}

export function resolveEmbeddingMode(
  configuredMode: string | undefined,
  environment: string | undefined,
): EmbeddingMode {
  if (!configuredMode) {
    return "openai";
  }

  if (configuredMode === "mock" && environment === "development") {
    return "mock";
  }

  if (configuredMode === "mock") {
    throw new EmbeddingGenerationError(
      "Mock embeddings are available only during local development.",
    );
  }

  throw new EmbeddingGenerationError(
    "AI_EMBEDDINGS_MODE must be either omitted or set to mock for local development.",
  );
}

function validateEmbedding(embedding: number[]) {
  try {
    embeddingToPgVector(embedding);
  } catch {
    throw new EmbeddingGenerationError(
      `The embedding service returned an invalid ${EMBEDDING_DIMENSIONS}-dimension vector.`,
    );
  }

  return embedding;
}

function hashText(value: string, seed: number) {
  let hash = seed;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function createMockEmbedding(sourceChunk: string) {
  const embedding = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = sourceChunk.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const token of tokens) {
    const hash = hashText(token, 2_166_136_261);
    const index = hash % EMBEDDING_DIMENSIONS;
    embedding[index] += hash & 1 ? 1 : -1;
  }

  if (tokens.length === 0) {
    embedding[hashText(sourceChunk, 2_166_136_261) % EMBEDDING_DIMENSIONS] = 1;
  }

  const magnitude = Math.hypot(...embedding);
  return embedding.map((value) => value / magnitude);
}

/**
 * Creates reproducible stand-in vectors for local UI and access-control tests.
 * These vectors are not semantic embeddings and must never be used in production.
 */
export function createMockEmbeddings(sourceChunks: readonly string[]) {
  if (sourceChunks.length === 0 || sourceChunks.some((chunk) => !chunk.trim())) {
    throw new EmbeddingGenerationError("Source chunks must contain text.");
  }

  return sourceChunks.map((sourceChunk) => validateEmbedding(createMockEmbedding(sourceChunk)));
}

export async function generateEmbeddings(
  client: EmbeddingsClient,
  sourceChunks: readonly string[],
) {
  if (sourceChunks.length === 0 || sourceChunks.some((chunk) => !chunk.trim())) {
    throw new EmbeddingGenerationError("Source chunks must contain text.");
  }

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: [...sourceChunks],
    encoding_format: "float",
  });

  if (response.data.length !== sourceChunks.length) {
    throw new EmbeddingGenerationError();
  }

  const embeddings = Array<number[] | undefined>(sourceChunks.length);

  for (const item of response.data) {
    if (
      !Number.isInteger(item.index) ||
      item.index < 0 ||
      item.index >= sourceChunks.length ||
      embeddings[item.index]
    ) {
      throw new EmbeddingGenerationError();
    }

    embeddings[item.index] = validateEmbedding(item.embedding);
  }

  if (embeddings.some((embedding) => !embedding)) {
    throw new EmbeddingGenerationError();
  }

  return embeddings as number[][];
}
