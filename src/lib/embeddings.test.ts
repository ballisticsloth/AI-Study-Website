import { describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMENSIONS } from "./retrieval";
import {
  createMockEmbeddings,
  EMBEDDING_MODEL,
  EmbeddingGenerationError,
  generateEmbeddings,
  resolveEmbeddingMode,
} from "./embeddings";

function createEmbedding(value: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

describe("generateEmbeddings", () => {
  it("creates one validated embedding for each source chunk", async () => {
    const create = vi.fn().mockResolvedValue({
      data: [
        { index: 1, embedding: createEmbedding(-0.25) },
        { index: 0, embedding: createEmbedding(0.25) },
      ],
    });

    const embeddings = await generateEmbeddings(
      { embeddings: { create } },
      ["First source chunk", "Second source chunk"],
    );

    expect(create).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
      input: ["First source chunk", "Second source chunk"],
      encoding_format: "float",
    });
    expect(embeddings).toEqual([createEmbedding(0.25), createEmbedding(-0.25)]);
  });

  it("rejects incomplete or invalid API responses", async () => {
    const create = vi.fn().mockResolvedValue({
      data: [{ index: 0, embedding: [0.25] }],
    });

    await expect(
      generateEmbeddings({ embeddings: { create } }, ["First", "Second"]),
    ).rejects.toBeInstanceOf(EmbeddingGenerationError);
  });

  it("creates deterministic development-only mock embeddings", () => {
    const first = createMockEmbeddings(["Photosynthesis uses sunlight."]);
    const second = createMockEmbeddings(["Photosynthesis uses sunlight."]);
    const different = createMockEmbeddings(["The mitochondria produces energy."]);

    expect(first).toEqual(second);
    expect(first[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(first).not.toEqual(different);
  });

  it("allows mock embeddings only during local development", () => {
    expect(resolveEmbeddingMode("mock", "development")).toBe("mock");
    expect(resolveEmbeddingMode(undefined, "development")).toBe("openai");
    expect(() => resolveEmbeddingMode("mock", "production")).toThrow(
      "Mock embeddings are available only during local development",
    );
  });
});
