import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260805120000_scope_tutor_conversations.sql",
);

describe("tutor conversation scope migration", () => {
  it("persists an explicit material scope without treating old conversations as unscoped", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("add column source_document_ids jsonb not null");
    expect(migration).toContain("default '[]'::jsonb");
    expect(migration).toContain("jsonb_typeof(source_document_ids) = 'array'");
  });
});
