import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TutorWorkspace } from "./tutor-workspace";

const course = { id: "9ec17a67-498d-4942-b772-a56b6a993980", title: "Biology" };
const document = {
  id: "93ff1c6b-a92a-43af-91e8-8e02241d03c4",
  courseId: course.id,
  title: "Cell Structure Notes",
  originalFilename: "cells.pdf",
  storagePath: "private/cells.pdf",
  mimeType: "application/pdf",
  byteSize: 1024,
  status: "ready" as const,
  processingError: null,
  createdAt: "2026-08-05T00:00:00.000Z",
};

function streamResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        events.forEach((event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

describe("TutorWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts a scoped conversation and renders a streamed cited hint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse([
        {
          type: "conversation",
          conversation: {
            id: "e743e10b-8c6d-474e-b7b4-9cf96257e601",
            courseId: course.id,
            sourceDocumentIds: [document.id],
            title: "What does a cell membrane do?",
            createdAt: "2026-08-05T00:00:00.000Z",
            updatedAt: "2026-08-05T00:00:00.000Z",
          },
        },
        {
          type: "assistant",
          messageId: "67c32b6d-9c33-4881-8d8f-0169efae4e99",
          createdAt: "2026-08-05T00:00:01.000Z",
          grounding: "course_material",
          generationMode: "mock",
          citations: [
            {
              sourceChunkId: "a8c1b6c0-2472-42af-8ced-f4b2b2ddf571",
              documentId: document.id,
              documentTitle: document.title,
              pageNumber: 2,
              heading: "Cell membrane",
              excerpt: "The cell membrane controls what enters and leaves the cell.",
            },
          ],
        },
        { type: "delta", value: "What do you think the source suggests?" },
        { type: "done" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TutorWorkspace courses={[course]} documents={[document]} conversations={[]} />);

    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What does a cell membrane do?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tutor/message",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("What do you think the source suggests?")).not.toBeNull();
    expect(screen.getByText("Cell Structure Notes · Page 2 · Cell membrane")).not.toBeNull();
    expect(screen.getByText("Development mode: this is a deterministic guidance-first tutor response.")).not.toBeNull();
  });

  it("labels a saved no-source response as general knowledge", () => {
    render(
      <TutorWorkspace
        courses={[course]}
        documents={[document]}
        conversations={[
          {
            id: "e743e10b-8c6d-474e-b7b4-9cf96257e601",
            courseId: course.id,
            title: "Mitosis",
            topicFocus: null,
            sourceDocumentIds: [document.id],
            createdAt: "2026-08-05T00:00:00.000Z",
            updatedAt: "2026-08-05T00:00:00.000Z",
            messages: [
              {
                id: "67c32b6d-9c33-4881-8d8f-0169efae4e99",
                role: "assistant",
                content: "General-knowledge response (not supported by the selected material): Try stating what you know.",
                citations: [],
                createdAt: "2026-08-05T00:01:00.000Z",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("General knowledge — no selected source supports this response.")).not.toBeNull();
  });
});
