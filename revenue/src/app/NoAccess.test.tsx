import axe from "axe-core";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing";
import { Gate } from "./Gate";

vi.mock("../api/client", () => ({
  apiClient: { get: async () => ({ status: 403 }) },
  NotSignedIn: class NotSignedIn extends Error {},
}));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe.each([["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const)("no access, %s %s", (theme, locale) => {
  it("has no axe violations", async () => {
    renderApp(<Gate><p>the app</p></Gate>, { theme, locale });
    await screen.findByRole("heading", { level: 1 });
    const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
