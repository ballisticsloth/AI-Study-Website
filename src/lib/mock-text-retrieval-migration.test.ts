import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260803130000_add_private_mock_text_retrieval.sql",
);

describe("private mock text retrieval migration", () => {
  it("matches content, document titles, and headings only inside the authenticated scope", () => {
    const migration = readFileSync(migrationPath, "utf8");
    const whereClause = migration.indexOf("where document_row.owner_id");
    const orderBy = migration.indexOf("order by ts_rank_cd");

    expect(migration).toContain("websearch_to_tsquery('english', p_query)");
    expect(migration).toContain("document_row.title");
    expect(migration).toContain("chunk.heading");
    expect(migration).toContain("chunk.content");
    expect(whereClause).toBeGreaterThan(-1);
    expect(whereClause).toBeLessThan(orderBy);
    expect(migration).toContain("course_row.owner_id = (select auth.uid())");
    expect(migration).toContain("document_row.course_id = p_course_id");
    expect(migration).toContain("chunk.document_id = any(p_document_ids)");
  });

  it("is callable only by signed-in users", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("security invoker");
    expect(migration).toContain("revoke all on function public.match_document_chunks_by_text");
    expect(migration).toContain("to authenticated;");
  });
});
