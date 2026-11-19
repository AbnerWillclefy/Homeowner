import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HIDE_VALUES_STORAGE_KEY, HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { ShoppingList, ShoppingListItem } from "./api";
import { CHECKED_KEY } from "./logic/checked";
import { ShoppingListPage } from "./ShoppingListPage";

// Radix Checkbox, Dialog and Progress measure with these, which jsdom lacks.
Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getList: vi.fn(), editListItem: vi.fn() }));

const line = (over: Partial<ShoppingListItem>): ShoppingListItem => ({ itemId: "p1", name: "Arroz", preferredBrand: null, fixed: false, quantityMilli: 1000, unit: "UN", ...over });
const RICE = line({ fixed: true, unitPriceCents: 2790, priceCents: 2790 });
const BEANS = line({ itemId: "p2", name: "Feijão", quantityMilli: 2000, unitPriceCents: 819, priceCents: 1638 });
const CHEESE = line({ itemId: "p3", name: "Queijo minas", unit: "KG", quantityMilli: 450, unitPriceCents: 6490, priceCents: 2921 });
const SALT = line({ itemId: "p4", name: "Sal" });
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const list = (over: Partial<ShoppingList> = {}): ShoppingList => ({ items: [RICE, BEANS, CHEESE, SALT], expectedTotalCents: 6349, groceriesLeftCents: 20_000, ...over });
const serve = (value: ShoppingList) => vi.mocked(api.getList).mockResolvedValue(value);
const open = (locale: "pt-BR" | "en" = "en") => renderApp(<HideValuesProvider><ShoppingListPage /></HideValuesProvider>, { path: "/pantry/list", locale });
const row = (name: string) => screen.getByText(name).closest("li")!;
const MONEY = (cents: string) => new RegExp(cents.replace(".", "[,.]"));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.editListItem).mockReset().mockResolvedValue({ kind: "ok" });
});
afterEach(() => vi.clearAllMocks());

describe("the list", () => {
  it("shows ran-out and fixed lines with quantity and price, and no price for one never bought", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    expect(screen.getByRole("heading", { level: 1, name: "Shopping list" })).toBeTruthy();
    expect(screen.getByText("4 items · 0 checked")).toBeTruthy();
    expect(row("Arroz").textContent).toMatch(MONEY("27.90"));
    expect(within(row("Feijão")).getByRole("status").textContent).toBe("2");
    expect(row("Feijão").textContent).toMatch(MONEY("8.19"));
    expect(row("Queijo minas").textContent).toContain("0.450 kg");
    expect(row("Queijo minas").textContent).toMatch(/64[,.]90\/kg/);
    expect(row("Sal").textContent).toContain("no price yet");
    expect(row("Sal").textContent).not.toMatch(/R\$/);
  });

  it("counts one item in the singular, in pt-BR", async () => {
    serve(list({ items: [SALT], expectedTotalCents: 0 }));
    open("pt-BR");
    expect(await screen.findByText("1 item · 0 marcados")).toBeTruthy();
  });

  it("lays the list on eight columns and the summary on four of one grid", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    const grid = document.querySelector(".desktop\\:grid-cols-12")!;
    expect([...grid.children].map((c) => c.className.match(/desktop:col-span-\d+/)![0]).sort()).toEqual(["desktop:col-span-4", "desktop:col-span-8"]);
  });

  it("shows an empty state, spanning the grid", async () => {
    serve(list({ items: [], expectedTotalCents: 0 }));
    open();
    expect(await screen.findByText("List is empty")).toBeTruthy();
    expect(screen.getByText("0 items")).toBeTruthy();
    expect(document.querySelector(".desktop\\:grid-cols-12")!.children[0]!.className).toContain("desktop:col-span-12");
  });

  it("shows a loading state", () => {
    vi.mocked(api.getList).mockReturnValue(new Promise(() => {}));
    open();
    expect(screen.getByLabelText("Loading the list").getAttribute("aria-busy")).toBe("true");
  });

  it("shows an error with Retry, never the empty state, and reads again on Retry", async () => {
    vi.mocked(api.getList).mockRejectedValueOnce(new Error("503")).mockResolvedValue(list());
    open();
    expect(await screen.findByText("Couldn't load the list.")).toBeTruthy();
    expect(screen.queryByText("List is empty")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Arroz")).toBeTruthy();
  });
});

describe("the summary", () => {
  it("shows the expected total next to what is left, and counts the lines with no price", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    expect(screen.getByText("Expected total")).toBeTruthy();
    expect(screen.getAllByText(MONEY("63.49")).length).toBeGreaterThan(0);
    expect(screen.getByText("Left of groceries limit")).toBeTruthy();
    expect(screen.getAllByText(MONEY("200")).length).toBeGreaterThan(0);
    expect(screen.getByText("1 item without a price")).toBeTruthy();
    expect(screen.queryByText(/Over the groceries limit/)).toBeNull();
  });

  it("says how much over the limit it is, and blocks nothing", async () => {
    serve(list({ groceriesLeftCents: 5000 }));
    open();
    await screen.findByText("Arroz");
    expect(screen.getByText(/Over the groceries limit by .*13[,.]49\. You can still buy\./)).toBeTruthy();
    expect(screen.getAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled)).toEqual([]);
  });

  it("counts a left that is already negative as over", async () => {
    serve(list({ groceriesLeftCents: -1000 }));
    open();
    expect(await screen.findByText(/Over the groceries limit by .*73[,.]49/)).toBeTruthy();
  });

  it("shows the total alone, with a way to set a limit, when there is none", async () => {
    serve(list({ groceriesLeftCents: undefined }));
    open();
    await screen.findByText("Arroz");
    expect(screen.getAllByText(MONEY("63.49")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Left of groceries limit")).toBeNull();
    expect(screen.getByText("No groceries limit.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set" }).getAttribute("href")).toBe("/categories");
  });

  it("hides every amount when values are hidden", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    serve(list({ groceriesLeftCents: 5000 }));
    const { container } = open();
    await screen.findByText("Arroz");
    expect(container.textContent).not.toMatch(/R\$\s?\d/);
    expect(container.textContent).toContain("Over the groceries limit by hidden value.");
  });
});

describe("editing", () => {
  it("steps a unit by one and a weight by 0,1 kg, then sends one write with the final value", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    const more = within(row("Feijão")).getByRole("button", { name: "More" });
    await userEvent.click(more);
    await userEvent.click(more);
    await userEvent.click(within(row("Queijo minas")).getByRole("button", { name: "More" }));
    // The screen answers at once: the line and the total are repriced.
    expect(within(row("Feijão")).getByRole("status").textContent).toBe("4");
    expect(within(row("Queijo minas")).getByRole("status").textContent).toBe("0.550 kg");
    expect(row("Feijão").textContent).toMatch(MONEY("32.76"));
    await waitFor(() => expect(api.editListItem).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(vi.mocked(api.editListItem).mock.calls.map((c) => [c[0], c[1]]).sort()).toEqual([["p2", { quantityMilli: 4000 }], ["p3", { quantityMilli: 550 }]]);
  });

  it("will not step below the minimum", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Arroz")).getByRole("button", { name: "Less" }));
    expect(within(row("Arroz")).getByRole("status").textContent).toBe("1");
    await new Promise((r) => setTimeout(r, 700));
    expect(api.editListItem).not.toHaveBeenCalled();
  });

  it("puts the quantity back when the write fails, and says so", async () => {
    vi.mocked(api.editListItem).mockResolvedValue({ kind: "error" });
    serve(list());
    open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Feijão")).getByRole("button", { name: "More" }));
    expect(within(row("Feijão")).getByRole("status").textContent).toBe("3");
    expect(await screen.findByText("We couldn't save. The item went back as it was.", {}, { timeout: 3000 })).toBeTruthy();
    expect(within(row("Feijão")).getByRole("status").textContent).toBe("2");
  });

  it("asks before removing, and removing sends the edit and drops the line and its price from the total", async () => {
    serve(list());
    // The server no longer lists it once removed, so the read after the write agrees.
    vi.mocked(api.editListItem).mockImplementation(async () => { serve(list({ items: [RICE, CHEESE, SALT], expectedTotalCents: 4711 })); return { kind: "ok" }; });
    open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Feijão")).getByRole("button", { name: "Remove Feijão" }));
    expect(api.editListItem).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("Feijão")).toBeNull());
    expect(api.editListItem).toHaveBeenCalledWith("p2", { removed: true });
    expect(screen.getByText("3 items · 0 checked")).toBeTruthy();
    expect(screen.getAllByText(MONEY("47.11")).length).toBeGreaterThan(0);
  });

  it("cancelling the question keeps the line and sends nothing", async () => {
    serve(list());
    open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Feijão")).getByRole("button", { name: "Remove Feijão" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Feijão")).toBeTruthy();
    expect(api.editListItem).not.toHaveBeenCalled();
  });

  it("brings a removed line back when the write fails", async () => {
    vi.mocked(api.editListItem).mockResolvedValue({ kind: "error" });
    serve(list());
    open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Feijão")).getByRole("button", { name: "Remove Feijão" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("We couldn't save. The item went back as it was.")).toBeTruthy();
    expect(screen.getByText("Feijão")).toBeTruthy();
  });

  it("sends a quantity still waiting when the screen is left", async () => {
    serve(list());
    const { unmount } = open();
    await screen.findByText("Arroz");
    await userEvent.click(within(row("Feijão")).getByRole("button", { name: "More" }));
    act(() => unmount());
    expect(api.editListItem).toHaveBeenCalledWith("p2", { quantityMilli: 3000 });
  });
});

describe("ticks", () => {
  it("keep the row in place struck through, persist across a remount, and call no API", async () => {
    serve(list());
    const first = open();
    await screen.findByText("Arroz");
    await userEvent.click(screen.getByRole("checkbox", { name: "Check Feijão" }));
    expect(screen.getByText("4 items · 1 checked")).toBeTruthy();
    expect(screen.getByText("Feijão").className).toContain("line-through");
    expect(JSON.parse(localStorage.getItem(CHECKED_KEY)!)).toEqual(["p2"]);
    first.unmount();
    open();
    await screen.findByText("Arroz");
    expect((screen.getByRole("checkbox", { name: "Check Feijão" }) as HTMLElement).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("checkbox", { name: "Check Feijão" }));
    expect(JSON.parse(localStorage.getItem(CHECKED_KEY)!)).toEqual([]);
    expect(api.editListItem).not.toHaveBeenCalled();
    expect(api.getList).toHaveBeenCalled();
  });

  it("drops the tick of an item that left the list, and reads a damaged value as none", async () => {
    localStorage.setItem(CHECKED_KEY, '["p2","gone"]');
    serve(list());
    open();
    await screen.findByText("Arroz");
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CHECKED_KEY)!)).toEqual(["p2"]));
  });

  it("treats a damaged stored value as no ticks", async () => {
    localStorage.setItem(CHECKED_KEY, "{oops");
    serve(list());
    open();
    await screen.findByText("Arroz");
    expect(screen.getByText("4 items · 0 checked")).toBeTruthy();
  });
});

describe("accessibility", () => {
  it.each(["pt-BR", "en"] as const)("has no axe violations in %s", async (locale) => {
    serve(list({ groceriesLeftCents: 5000 }));
    open(locale);
    await screen.findByText("Arroz");
    const { violations } = await axe.run(document.body, AXE);
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
});
