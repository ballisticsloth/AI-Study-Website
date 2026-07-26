import "server-only";

import mammoth from "mammoth";
import { parseFragment } from "parse5";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_PAGES = 250;
export const MAX_EXTRACTED_CHARACTERS = 500_000;
export const MAX_DOCUMENT_SECTIONS = 500;
export const MAX_DOCUMENT_CHUNKS = 350;

const CHUNK_CHARACTER_LIMIT = 2_200;
const CHUNK_OVERLAP_CHARACTERS = 240;

type SourceMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain";

export type ExtractedDocumentSection = {
  sectionIndex: number;
  pageNumber: number | null;
  heading: string | null;
  sourceText: string;
};

export type ExtractedDocumentChunk = {
  sectionIndex: number;
  chunkIndex: number;
  content: string;
};

export type ExtractedDocumentSource = {
  sections: ExtractedDocumentSection[];
  chunks: ExtractedDocumentChunk[];
};

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  childNodes?: HtmlNode[];
};

type SectionBuilder = {
  heading: string | null;
  textParts: string[];
};

export class DocumentIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentIngestionError";
  }
}

function normalizeSourceText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeInlineText(value: string) {
  return normalizeSourceText(value).replace(/\s+/g, " ").trim();
}

function hasPdfSignature(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

function hasZipSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 2 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b
  );
}

function textFromHtmlNode(node: HtmlNode): string {
  if (node.nodeName === "#text") {
    return node.value ?? "";
  }

  if (node.tagName === "br") {
    return "\n";
  }

  return (node.childNodes ?? []).map(textFromHtmlNode).join("");
}

function isHeadingNode(node: HtmlNode) {
  return /^h[1-6]$/.test(node.tagName ?? "");
}

function isTextBlockNode(node: HtmlNode) {
  return ["p", "li", "td", "th", "blockquote", "pre"].includes(node.tagName ?? "");
}

function extractDocxSectionsFromHtml(html: string): ExtractedDocumentSection[] {
  const fragment = parseFragment(html) as unknown as { childNodes: HtmlNode[] };
  const sections: ExtractedDocumentSection[] = [];
  const headingLevels: Array<string | null> = [null, null, null, null, null, null];
  let currentSection: SectionBuilder = { heading: null, textParts: [] };

  function flushCurrentSection() {
    const sourceText = normalizeSourceText(currentSection.textParts.join("\n\n"));

    if (sourceText) {
      sections.push({
        sectionIndex: sections.length,
        pageNumber: null,
        heading: currentSection.heading,
        sourceText,
      });
    }
  }

  function visit(nodes: HtmlNode[]) {
    for (const node of nodes) {
      if (isHeadingNode(node)) {
        flushCurrentSection();

        const heading = normalizeInlineText(textFromHtmlNode(node));
        const level = Number(node.tagName?.slice(1));

        if (heading && Number.isInteger(level) && level >= 1 && level <= 6) {
          headingLevels[level - 1] = heading;
          headingLevels.fill(null, level);
          currentSection = {
            heading: headingLevels.filter((part): part is string => Boolean(part)).join(" › "),
            textParts: [],
          };
        } else {
          currentSection = { heading: null, textParts: [] };
        }

        continue;
      }

      if (isTextBlockNode(node)) {
        const text = normalizeSourceText(textFromHtmlNode(node));

        if (text) {
          currentSection.textParts.push(text);
        }

        continue;
      }

      if (node.childNodes) {
        visit(node.childNodes);
      }
    }
  }

  visit(fragment.childNodes);
  flushCurrentSection();

  return sections;
}

function decodePlainText(bytes: Uint8Array) {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
    }

    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new DocumentIngestionError(
      "This TXT file must use UTF-8 or UTF-16 text encoding.",
    );
  }
}

function extractPlainTextSections(bytes: Uint8Array): ExtractedDocumentSection[] {
  const text = normalizeSourceText(decodePlainText(bytes));

  if (!text || text.includes("\0")) {
    throw new DocumentIngestionError("No readable text was found in this TXT file.");
  }

  const sections: ExtractedDocumentSection[] = [];
  const headingLevels: Array<string | null> = [null, null, null, null, null, null];
  let currentSection: SectionBuilder = { heading: null, textParts: [] };

  function flushCurrentSection() {
    const sourceText = normalizeSourceText(currentSection.textParts.join("\n"));

    if (sourceText) {
      sections.push({
        sectionIndex: sections.length,
        pageNumber: null,
        heading: currentSection.heading,
        sourceText,
      });
    }
  }

  for (const line of text.split("\n")) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (!headingMatch) {
      currentSection.textParts.push(line);
      continue;
    }

    flushCurrentSection();

    const level = headingMatch[1].length;
    const heading = normalizeInlineText(headingMatch[2]);
    headingLevels[level - 1] = heading;
    headingLevels.fill(null, level);
    currentSection = {
      heading: headingLevels.filter((part): part is string => Boolean(part)).join(" › ") || null,
      textParts: [],
    };
  }

  flushCurrentSection();
  return sections;
}

async function extractPdfSections(bytes: Uint8Array): Promise<ExtractedDocumentSection[]> {
  if (!hasPdfSignature(bytes)) {
    throw new DocumentIngestionError("The file contents do not match a PDF document.");
  }

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;

  try {
    pdf = await getDocumentProxy(bytes, {
      maxImageSize: 16_777_216,
      stopAtErrors: true,
    });

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new DocumentIngestionError(
        `This PDF has more than ${MAX_PDF_PAGES} pages and cannot be processed yet.`,
      );
    }

    const { text } = await extractText(pdf);
    const sections = text.flatMap((pageText, pageIndex) => {
      const sourceText = normalizeSourceText(pageText);

      return sourceText
        ? [
            {
              sectionIndex: pageIndex,
              pageNumber: pageIndex + 1,
              heading: null,
              sourceText,
            },
          ]
        : [];
    });

    if (sections.length === 0) {
      throw new DocumentIngestionError(
        "No selectable text was found in this PDF. Scanned PDFs need OCR, which is not available yet.",
      );
    }

    return sections;
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      throw error;
    }

    throw new DocumentIngestionError(
      "This PDF could not be read. Make sure it is not password-protected or corrupted.",
    );
  } finally {
    if (pdf) {
      await pdf.loadingTask.destroy().catch(() => undefined);
    }
  }
}

async function extractDocxSections(bytes: Uint8Array): Promise<ExtractedDocumentSection[]> {
  if (!hasZipSignature(bytes)) {
    throw new DocumentIngestionError("The file contents do not match a DOCX document.");
  }

  try {
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
        externalFileAccess: false,
        includeEmbeddedStyleMap: false,
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
        ],
      },
    );
    const sections = extractDocxSectionsFromHtml(result.value);

    if (sections.length === 0) {
      throw new DocumentIngestionError("No readable text was found in this DOCX file.");
    }

    return sections;
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      throw error;
    }

    throw new DocumentIngestionError(
      "This DOCX file could not be read. Make sure it is a valid Word document.",
    );
  }
}

function enforceExtractionLimits(sections: ExtractedDocumentSection[]) {
  if (sections.length > MAX_DOCUMENT_SECTIONS) {
    throw new DocumentIngestionError(
      `This file has more than ${MAX_DOCUMENT_SECTIONS} readable sections and cannot be processed yet.`,
    );
  }

  const totalCharacters = sections.reduce((total, section) => total + section.sourceText.length, 0);

  if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new DocumentIngestionError(
      "This file contains too much text to process at once. Split it into smaller materials and try again.",
    );
  }
}

function findChunkEnd(text: string, start: number) {
  const maximumEnd = Math.min(text.length, start + CHUNK_CHARACTER_LIMIT);

  if (maximumEnd === text.length) {
    return maximumEnd;
  }

  const candidate = text.slice(start, maximumEnd);
  const boundaries = [...candidate.matchAll(/\n{2,}|\n|(?<=[.!?])\s+/g)];
  const preferredBoundary = boundaries
    .map((boundary) => start + (boundary.index ?? 0) + boundary[0].length)
    .filter((boundary) => boundary >= start + Math.floor(CHUNK_CHARACTER_LIMIT * 0.55))
    .at(-1);

  if (preferredBoundary) {
    return preferredBoundary;
  }

  const whitespaceBoundary = candidate.lastIndexOf(" ");
  return whitespaceBoundary > 0 ? start + whitespaceBoundary + 1 : maximumEnd;
}

function splitTextIntoChunks(text: string) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = findChunkEnd(text, start);
    const content = text.slice(start, end).trim();

    if (content) {
      chunks.push(content);
    }

    if (end >= text.length) {
      break;
    }

    const overlapStart = Math.max(start + 1, end - CHUNK_OVERLAP_CHARACTERS);
    const nextWhitespace = text.indexOf(" ", overlapStart);
    start = nextWhitespace > start && nextWhitespace < end ? nextWhitespace + 1 : end;
  }

  return chunks;
}

function createChunks(sections: ExtractedDocumentSection[]) {
  const chunks: ExtractedDocumentChunk[] = [];

  for (const section of sections) {
    for (const content of splitTextIntoChunks(section.sourceText)) {
      chunks.push({
        sectionIndex: section.sectionIndex,
        chunkIndex: chunks.length,
        content,
      });
    }
  }

  if (chunks.length === 0) {
    throw new DocumentIngestionError("No readable text was found in this file.");
  }

  if (chunks.length > MAX_DOCUMENT_CHUNKS) {
    throw new DocumentIngestionError(
      "This file creates too many source passages to process at once. Split it into smaller materials and try again.",
    );
  }

  return chunks;
}

export async function extractDocumentSource({
  bytes,
  mimeType,
}: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<ExtractedDocumentSource> {
  let sections: ExtractedDocumentSection[];

  switch (mimeType as SourceMimeType) {
    case "application/pdf":
      sections = await extractPdfSections(bytes);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      sections = await extractDocxSections(bytes);
      break;
    case "text/plain":
      sections = extractPlainTextSections(bytes);
      break;
    default:
      throw new DocumentIngestionError("This file type is not supported for source processing.");
  }

  enforceExtractionLimits(sections);

  return {
    sections,
    chunks: createChunks(sections),
  };
}

export function userFacingIngestionError(error: unknown) {
  if (error instanceof DocumentIngestionError) {
    return error.message;
  }

  return "This file could not be processed. Try uploading it again or choose a different file.";
}
