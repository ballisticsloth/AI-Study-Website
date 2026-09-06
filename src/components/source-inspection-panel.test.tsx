import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchSourcePassages } from "@/app/materials/retrieval-actions";

import { SourceInspectionPanel } from "./source-inspection-panel";

vi.mock("@/app/materials/retrieval-actions", () => ({
  searchSourcePassages: vi.fn(),
}));

const courses = [
  { id: "9ec17a67-498d-4942-b772-a56b6a993980", title: "Physics" },
];

const documents = [
  {
    id: "d3127676-0f52-4f24-a4f4-b71903bcb55d",
    courseId: courses[0].id,
    title: "Motion notes",
    originalFilename: "motion-notes.pdf",
    storagePath: "private/motion-notes.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    status: "ready" as const,
    processingError: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "09388a55-070f-401b-a91c-35bb637fdc13",
    courseId: courses[0].id,
    title: "Unprocessed notes",
    originalFilename: "unprocessed.txt",
    storagePath: "private/unprocessed.txt",
    mimeType: "text/plain",
    byteSize: 1024,
    status: "uploading" as const,
    processingError: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

describe("SourceInspectionPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(searchSourcePassages).mockReset();
  });

  it("searches only ready material in the selected course and displays compact citations", async () => {
    vi.mocked(searchSourcePassages).mockResolvedValue({
      embeddingMode: "mock",
      passages: [
        {
          id: "844168a7-c7f0-4e83-8e77-e787bfb8efec",
          documentId: documents[0].id,
          documentTitle: "Motion notes",
          pageNumber: 3,
          heading: "Newton's laws",
          content: "An object remains at rest or in uniform motion unless acted on by a net force.",
          similarity: 0.87,
        },
      ],
    });

    render(<SourceInspectionPanel courses={courses} documents={documents} />);

    fireEvent.change(screen.getByLabelText("Question or topic"), {
      target: { value: "What is Newton's first law?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find source passages" }));

    await waitFor(() => {
      expect(searchSourcePassages).toHaveBeenCalledWith({
        courseId: courses[0].id,
        documentIds: [documents[0].id],
        query: "What is Newton's first law?",
      });
    });

    expect(await screen.findByText("Motion notes · Page 3 · Newton's laws")).not.toBeNull();
    expect(
      screen.getByText("An object remains at rest or in uniform motion unless acted on by a net force."),
    ).not.toBeNull();
    expect(
      screen.getByText("Development mode: matching uses exact words, not AI semantics."),
    ).not.toBeNull();
  });

  it("does not send a search when the course has no ready material", () => {
    render(<SourceInspectionPanel courses={courses} documents={[documents[1]]} />);

    expect(
      screen.getByText("Process at least one source in this course to inspect citations."),
    ).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Find source passages" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
