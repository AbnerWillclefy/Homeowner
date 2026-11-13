import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { Spending } from "./api";
import type { SpendingCategory } from "./logic/categories";
import { withLimit } from "./logic/limit";
import { CategoryPage } from "./CategoryPage";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getSpending: vi.fn(), getHistory: vi.fn(), putBudget: vi.fn() }));

const SPENDING: Spending = { categories: [{ category: "groceries", spentCents: 180000 }], limits: { groceries: 200000 }, transactions: [] };
const nb = (s: string) => (node: string) => node.replace(/\u00a0/g, " ") === s;
const open = () => renderApp(<Routes><Route path="/categories/:category" element={<CategoryPage />} /></Routes>, { path: "/categories/groceries", locale: "en" });

// A server that keeps what is saved, so the read after a save sees it.
let limits: Spending["limits"];
const stored = (kind: "ok" | "error") => async (category: SpendingCategory, cents: number | null) => {
  if (kind === "ok") limits = withLimit(limits, category, cents);
  return { kind };
};

beforeEach(() => {
  limits = { ...SPENDING.limits };
  for (const fn of [api.getSpending, api.getHistory, api.putBudget]) vi.mocked(fn).mockReset();
  vi.mocked(api.getSpending).mockImplementation(async () => ({ ...SPENDING, limits }));
  vi.mocked(api.getHistory).mockResolvedValue({ months: [] });
});

describe("setting and removing the Spending limit", () => {
  it("saves a new limit, updates the bar at once and reads the finance views again", async () => {
    vi.mocked(api.putBudget).mockImplementation(stored("ok"));
    const { client } = open();
    const field = await screen.findByRole("textbox");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.clear(field);
    await userEvent.type(field, "1500");
    await userEvent.click(screen.getByRole("button", { name: "Save limit" }));
    expect(api.putBudget).toHaveBeenCalledWith("groceries", 150000);
    expect(await screen.findByText(nb("R$300.00 over the limit"))).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("saved");
    await waitFor(() => expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["finance", "transactions"], ["finance", "commitments"]]));
  });

  it("removes it with null and drops the bar", async () => {
    vi.mocked(api.putBudget).mockImplementation(stored("ok"));
    open();
    await screen.findByText(nb("R$200.00 under the limit"));
    await userEvent.click(screen.getByRole("button", { name: "Remove limit" }));
    expect(api.putBudget).toHaveBeenCalledWith("groceries", null);
    await waitFor(() => expect(screen.queryByText(nb("R$200.00 under the limit"))).toBeNull());
    expect(screen.queryByRole("button", { name: "Remove limit" })).toBeNull();
  });

  it("puts the old limit back and says so when the write fails", async () => {
    vi.mocked(api.putBudget).mockImplementation(stored("error"));
    open();
    await screen.findByText(nb("R$200.00 under the limit"));
    await userEvent.click(screen.getByRole("button", { name: "Remove limit" }));
    expect(await screen.findByText(/went back as it was/)).toBeTruthy();
    expect(screen.getByText(nb("R$200.00 under the limit"))).toBeTruthy();
  });

  it("refuses zero and empty without calling the API", async () => {
    open();
    const field = await screen.findByRole("textbox");
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole("button", { name: "Save limit" }));
    expect(await screen.findByText("Enter an amount above zero.")).toBeTruthy();
    expect(api.putBudget).not.toHaveBeenCalled();
  });
});
