import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import { ONBOARDING_DONE_KEY } from "../domains/onboarding/logic/onboardingDone";
import * as settings from "../domains/settings/api";
import { renderApp } from "../testing";
import { Gate } from "./Gate";

type Reply = { status: number; data?: unknown };
const get = vi.fn<(url: string) => Promise<Reply>>();
vi.mock("../api/client", () => ({
  apiClient: { get: (url: string) => get(url) },
  NotSignedIn: class NotSignedIn extends Error {},
}));

vi.mock("../domains/settings/api", () => ({ getMonthlyIncome: vi.fn() }));

const gate = (reply: () => Promise<Reply>, locale: "pt-BR" | "en" = "en") => {
  get.mockImplementation(reply);
  return renderApp(
    <Gate>
      <p>the app</p>
    </Gate>,
    { locale },
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(settings.getMonthlyIncome).mockResolvedValue(5_000_00);
});
afterEach(() => get.mockReset());

describe("Gate", () => {
  it("renders the children on a 200, after asking GET /me/finance", async () => {
    gate(async () => ({ status: 200 }));
    expect(await screen.findByText("the app")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/me/finance");
  });

  it("shows no access on a 403, mounts nothing else, has no link, and signs out from its button", async () => {
    const { auth, container } = gate(async () => ({ status: 403 }), "pt-BR");
    expect(await screen.findByRole("heading", { name: "Sem acesso" })).toBeTruthy();
    expect(screen.queryByText("the app")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("says No access in English", async () => {
    gate(async () => ({ status: 403 }));
    expect(await screen.findByRole("heading", { name: "No access" })).toBeTruthy();
  });

  it("signs out on a 401", async () => {
    const { auth } = gate(async () => ({ status: 401 }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("the app")).toBeNull();
  });

  it("offers Retry on a 503, not no access", async () => {
    gate(async () => ({ status: 503, data: { error: "finance not configured" } }));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No access")).toBeNull();
    expect(screen.queryByText("the app")).toBeNull();
  });

  it("offers Retry on a network error and keeps the session, and a retry can open the gate", async () => {
    const { auth } = gate(async () => {
      throw new Error("Network Error");
    });
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(auth.signOut).not.toHaveBeenCalled();
    get.mockImplementation(async () => ({ status: 200 }));
    await userEvent.click(retry);
    expect(await screen.findByText("the app")).toBeTruthy();
  });

  it("keeps the app mounted when a later refetch fails", async () => {
    const { client } = gate(async () => ({ status: 200 }));
    expect(await screen.findByText("the app")).toBeTruthy();
    get.mockImplementation(async () => {
      throw new Error("Network Error");
    });
    await client.refetchQueries();
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByText("the app")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows only a status while the answer is pending", () => {
    gate(() => new Promise(() => {}));
    expect(screen.getByRole("status").textContent).toBe("Checking your access…");
    expect(screen.queryByText("the app")).toBeNull();
  });
});

describe("first run", () => {
  const ME = { status: 200, data: { sources: [] } };
  const FOUND = { status: 200, data: { sources: [{ id: "s1" }] } };
  // Where the first-timer lands: the routes the gate sits in front of.
  const visit = (reply: Reply, path = "/") => {
    get.mockImplementation(async () => reply);
    return renderApp(
      <Gate>
        <Routes>
          <Route path="/" element={<p>the overview</p>} />
          <Route path="/sources" element={<p>sources</p>} />
          <Route path="/onboarding" element={<p>onboarding</p>} />
        </Routes>
      </Gate>,
      { locale: "en", path },
    );
  };

  it("sends a User with no Sources, no income and no flag to Onboarding", async () => {
    vi.mocked(settings.getMonthlyIncome).mockResolvedValue(null);
    visit(ME);
    expect(await screen.findByText("onboarding")).toBeTruthy();
    expect(screen.queryByText("the overview")).toBeNull();
  });

  it.each([
    ["has Sources", FOUND, null, undefined],
    ["has Monthly income", ME, 5_000_00, undefined],
    ["has finished or skipped it here", ME, null, "1"],
  ] as const)("shows the Overview to a User who %s", async (_name, reply, income, flag) => {
    vi.mocked(settings.getMonthlyIncome).mockResolvedValue(income);
    if (flag) localStorage.setItem(ONBOARDING_DONE_KEY, flag);
    visit(reply);
    expect(await screen.findByText("the overview")).toBeTruthy();
    expect(screen.queryByText("onboarding")).toBeNull();
  });

  it("does not hold back a deep link such as /sources", async () => {
    vi.mocked(settings.getMonthlyIncome).mockResolvedValue(null);
    visit(ME, "/sources");
    expect(await screen.findByText("sources")).toBeTruthy();
    expect(settings.getMonthlyIncome).not.toHaveBeenCalled();
  });

  it("shows the app, not Onboarding, when the income cannot be read", async () => {
    vi.mocked(settings.getMonthlyIncome).mockRejectedValue(new Error("down"));
    visit(ME);
    expect(await screen.findByText("the overview")).toBeTruthy();
  });
});
