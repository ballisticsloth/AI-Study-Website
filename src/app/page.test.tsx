import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("offers workspace creation from the landing page", () => {
    render(<Home />);

    const signInLink = screen.getAllByRole("link", {
      name: "Create your workspace",
    })[0];

    expect(signInLink.getAttribute("href")).toBe("/sign-in");
  });
});
