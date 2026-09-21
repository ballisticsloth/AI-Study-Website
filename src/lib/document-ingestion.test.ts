import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractDocxSectionsFromHtml } from "./document-ingestion";

describe("extractDocxSectionsFromHtml", () => {
  it("turns a DOCX table into labeled rows instead of a flattened word stream", () => {
    const sections = extractDocxSectionsFromHtml(`
      <h1>Comparing Organelles</h1>
      <table>
        <thead>
          <tr><th>Structure</th><th>Main function</th><th>Present in</th></tr>
        </thead>
        <tbody>
          <tr><td>Mitochondrion</td><td>Releases usable energy from food</td><td>Plant and animal cells</td></tr>
        </tbody>
      </table>
    `);

    expect(sections).toEqual([
      expect.objectContaining({
        heading: "Comparing Organelles",
        sourceText:
          "Structure: Mitochondrion | Main function: Releases usable energy from food | Present in: Plant and animal cells",
      }),
    ]);
  });

  it("recognizes bold Word header cells that are exported as ordinary table cells", () => {
    const sections = extractDocxSectionsFromHtml(`
      <h1>Comparing Organelles</h1>
      <table>
        <tr><td><p><strong>Structure</strong></p></td><td><p><strong>Main function</strong></p></td></tr>
        <tr><td><p>Chloroplast</p></td><td><p>Uses sunlight to make sugar</p></td></tr>
      </table>
    `);

    expect(sections[0]?.sourceText).toBe(
      "Structure: Chloroplast | Main function: Uses sunlight to make sugar",
    );
  });
});
