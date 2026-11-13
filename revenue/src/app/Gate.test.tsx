import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing";
import { Gate } from "./Gate";

type Reply = { status: number; data?: unknown };
const get = vi.fn<(url: string) => Promise<Reply>>();
vi.mock("../api/client", () => ({
  apiClient: { get: (url: string) => get(url) },
  NotSignedIn: class NotSignedIn extends Error {},
}));

const gate = (reply: () => Promise<Reply>, locale: "pt-BR" | "en" = "en") => {
  get.mockImplementation(reply);
  return renderApp(
    <Gate>
      <p>the app</p>
    </Gate>,
    { locale },
  );
};

beforeEach(() => localStorage.clear());
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

  it("shows only a status while the answer is pending", () => {
    gate(() => new Promise(() => {}));
    expect(screen.getByRole("status").textContent).toBe("Checking your access…");
    expect(screen.queryByText("the app")).toBeNull();
  });
});
