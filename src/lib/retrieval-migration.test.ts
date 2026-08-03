import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260730140000_add_private_vector_retrieval.sql",
);

describe("private vector retrieval migration", () => {
  it("uses the pgvector cosine operator class from the extensions schema", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "using hnsw (embedding extensions.vector_cosine_ops)",
    );
  });

  it("qualifies the pgvector cosine operator inside the locked-down function", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "chunk.embedding OPERATOR(extensions.<=>) p_query_embedding",
    );
  });

  it("can be retried safely after a failed push", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "add column if not exists embedding extensions.vector(1536)",
    );
    expect(migration).toContain(
      "create index if not exists document_chunks_embedding_hnsw_idx",
    );
  });

  it("applies ownership, course, and selected-document filters before ranking", () => {
    const migration = readFileSync(migrationPath, "utf8");
    const whereClause = migration.indexOf("where document_row.owner_id");
    const orderBy = migration.indexOf("order by chunk.embedding");

    expect(whereClause).toBeGreaterThan(-1);
    expect(whereClause).toBeLessThan(orderBy);
    expect(migration).toContain("course_row.owner_id = (select auth.uid())");
    expect(migration).toContain("document_row.course_id = p_course_id");
    expect(migration).toContain("chunk.document_id = any(p_document_ids)");
    expect(migration).toContain(
      "grant execute on function public.match_document_chunks",
    );
    expect(migration).toContain(") to authenticated;");
  });
});
