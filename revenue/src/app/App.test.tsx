import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as settings from "../domains/settings/api";
import * as sources from "../domains/sources/api";
import { renderApp } from "../testing";
import { App } from "./App";

vi.mock("../api/client", () => ({
  apiClient: { get: async () => ({ status: 200, data: { sources: [] } }) },
  NotSignedIn: class NotSignedIn extends Error {},
}));
vi.mock("../domains/settings/api", () => ({ getMonthlyIncome: vi.fn(), getCredentialsSaved: vi.fn() }));
vi.mock("../domains/sources/api", () => ({ getSources: vi.fn() }));

describe("App", () => {
  it("shows /onboarding in its own frame, outside the Shell", async () => {
    vi.mocked(settings.getMonthlyIncome).mockResolvedValue(null);
    vi.mocked(settings.getCredentialsSaved).mockResolvedValue(false);
    vi.mocked(sources.getSources).mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: null });
    renderApp(<App />, { locale: "en", path: "/onboarding" });
    expect(await screen.findByRole("heading", { level: 1, name: "Connect your Pluggy account" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  });
});
