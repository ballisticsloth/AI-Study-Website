import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260731160000_store_document_embeddings.sql",
);

describe("document embedding migration", () => {
  it("stores a validated embedding alongside each inserted chunk", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("embedding jsonb");
    expect(migration).toContain(
      "source_chunk.embedding::text::extensions.vector",
    );
  });
});
