import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  embeddingToPgVector,
} from "./retrieval";

describe("embeddingToPgVector", () => {
  it("serializes an embedding in pgvector's input format", () => {
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) =>
      index === 0 ? 0.25 : index === EMBEDDING_DIMENSIONS - 1 ? -0.5 : 0,
    );

    expect(embeddingToPgVector(embedding)).toMatch(/^\[0\.25,0,/);
    expect(embeddingToPgVector(embedding)).toMatch(/,0,-0\.5\]$/);
  });

  it("rejects an embedding with the wrong number of dimensions", () => {
    expect(() => embeddingToPgVector([0.25, -0.5])).toThrow(
      `must contain exactly ${EMBEDDING_DIMENSIONS} dimensions`,
    );
  });

  it("rejects non-finite embedding values", () => {
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
    embedding[10] = Number.NaN;

    expect(() => embeddingToPgVector(embedding)).toThrow(
      "must contain only finite numbers",
    );
  });
});
