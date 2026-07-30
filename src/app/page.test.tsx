import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("offers Google sign-in from the landing page", () => {
    render(<Home />);

    const signInLink = screen.getByRole("link", {
      name: "Continue with Google",
    });

    expect(signInLink.getAttribute("href")).toBe("/sign-in");
  });
});
