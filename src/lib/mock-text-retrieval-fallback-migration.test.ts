import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260805140000_add_ranked_mock_text_fallback.sql",
);

describe("ranked mock text retrieval fallback migration", () => {
  it("keeps strict matches first but permits a sufficiently strong partial lexical match", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("websearch_to_tsquery('english', p_query) as strict_terms");
    expect(migration).toContain("plainto_tsquery('english', p_query)::text");
    expect(migration).toContain("source_vector @@ query_terms.fallback_terms");
    expect(migration).toContain("or ranked.similarity >= 0.1");
    expect(migration).toContain("ranked.is_strict_match desc");
  });

  it("retains owner, course, ready-document, and selected-document boundaries", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("document_row.owner_id = (select auth.uid())");
    expect(migration).toContain("course_row.owner_id = (select auth.uid())");
    expect(migration).toContain("document_row.course_id = p_course_id");
    expect(migration).toContain("document_row.status = 'ready'");
    expect(migration).toContain("chunk.document_id = any(p_document_ids)");
  });
});
