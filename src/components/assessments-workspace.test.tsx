import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("@/app/assessments/actions", () => ({
  generateAssessment: vi.fn(),
  saveAssessment: vi.fn(),
  deleteAssessment: vi.fn(),
}));

import { AssessmentsWorkspace } from "./assessments-workspace";

describe("AssessmentsWorkspace", () => {
  afterEach(cleanup);

  it("offers source-based worksheet and test generation", () => {
    render(
      <AssessmentsWorkspace
        assessments={[]}
        courses={[{ id: "9ec17a67-498d-4942-b772-a56b6a993980", title: "Biology" }]}
        documents={[
          {
            id: "d3127676-0f52-4f24-a4f4-b71903bcb55d",
            courseId: "9ec17a67-498d-4942-b772-a56b6a993980",
            title: "Cell notes",
            originalFilename: "cells.pdf",
            storagePath: "private/cells.pdf",
            mimeType: "application/pdf",
            byteSize: 100,
            status: "ready",
            processingError: null,
            createdAt: "2026-08-04T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Create an assessment" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Generate editable draft" })).not.toBeNull();
    expect(screen.getByLabelText("Cell notes")).not.toBeNull();
  });
});
