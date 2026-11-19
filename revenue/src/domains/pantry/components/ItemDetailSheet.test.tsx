import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HIDE_VALUES_STORAGE_KEY, HideValuesProvider } from "../../../shared/HideValues";
import { renderApp } from "../../../testing";
import * as api from "../api";
import type { ItemDetail, PantryItem } from "../api";
import { PantryPage } from "../PantryPage";

Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock("../api", async (original) => ({ ...(await original<typeof import("../api")>()), getPantry: vi.fn(), getItem: vi.fn(), markRanOut: vi.fn(), undoRanOut: vi.fn() }));
vi.mock("../../bills/api", async (original) => ({ ...(await original<typeof import("../../bills/api")>()), getBills: vi.fn().mockResolvedValue([]) }));
vi.mock("../../sources/api", async (original) => ({ ...(await original<typeof import("../../sources/api")>()), getSources: vi.fn().mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: null }) }));

const RICE: PantryItem = { id: "p1", name: "Arroz", preferredBrand: "Tio João", fixed: true, state: "in_stock", ranOutOn: null };
const BEANS: PantryItem = { ...RICE, id: "p2", name: "Feijão", preferredBrand: null, fixed: false };
const price = (issuedOn: string, unitPriceCents: number, storeName: string) => ({ issuedOn, unitPriceCents, storeName });
// Newest first, as the API sends them.
const PRICES = [price("2030-01-02", 2790, "Bom Preço"), price("2029-12-01", 2400, "Atacadão"), price("2029-10-15", 2650, "Bom Preço")];
const detail = (over: Partial<ItemDetail> = {}): ItemDetail => ({ item: RICE, avgDurationDays: 22, prices: PRICES, ...over });
const serve = (d: ItemDetail) => vi.mocked(api.getItem).mockResolvedValue({ kind: "ok", detail: d });

const open = (locale: "pt-BR" | "en" = "en") => renderApp(<HideValuesProvider><PantryPage /></HideValuesProvider>, { path: "/pantry", locale });
const openRice = async (locale: "pt-BR" | "en" = "en") => {
  const view = open(locale);
  await userEvent.click(await screen.findByRole("button", { name: "Arroz" }));
  return { ...view, sheet: await screen.findByRole("dialog") };
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.mocked(api.getPantry).mockReset().mockResolvedValue([RICE, BEANS]);
  vi.mocked(api.getItem).mockReset();
  vi.mocked(api.markRanOut).mockReset().mockResolvedValue({ kind: "ok" });
  vi.mocked(api.undoRanOut).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("an item with purchases", () => {
  it("shows its head, the average, the last price with store and date, and the chart's alternative", async () => {
    serve(detail());
    const { sheet } = await openRice();
    expect(within(sheet).getByRole("heading", { name: "Arroz" })).toBeTruthy();
    expect(within(sheet).getByText("Tio João")).toBeTruthy();
    expect(within(sheet).getByText("Always buy")).toBeTruthy();
    expect(await within(sheet).findByText("22 days")).toBeTruthy();
    expect(within(sheet).getByText("Last price")).toBeTruthy();
    expect(within(sheet).getAllByText(/R\$\s?27[,.]90/)).toHaveLength(2); // the card and the chart's alternative
    expect(within(sheet).getByText("Bom Preço · Jan 2")).toBeTruthy();
    expect(within(sheet).getByRole("img").getAttribute("aria-label")).toMatch(/Price of Arroz: last .*27.*lowest .*24/);
    expect(within(sheet).getByText(/Lowest price .*24.* on Dec 1/)).toBeTruthy();
    expect(api.getItem).toHaveBeenCalledWith("p1");
  });

  it("says one day in the singular, in pt-BR", async () => {
    serve(detail({ avgDurationDays: 1 }));
    const { sheet } = await openRice("pt-BR");
    expect(await within(sheet).findByText("1 dia")).toBeTruthy();
    expect(within(sheet).getByText("Dura em média")).toBeTruthy();
  });

  it("holds a place for the forecast and computes nothing", async () => {
    serve(detail());
    const { sheet } = await openRice();
    expect(await within(sheet).findByText("coming soon", { exact: false })).toBeTruthy();
    expect(within(sheet).getByText("Forecast")).toBeTruthy();
  });

  it("replaces the chart with a line of text for a single purchase", async () => {
    serve(detail({ prices: [PRICES[0]!] }));
    const { sheet } = await openRice();
    expect(await within(sheet).findByText(/Only one purchase/)).toBeTruthy();
    expect(within(sheet).queryByRole("img")).toBeNull();
  });

  it("hides the last price and the chart's amounts when values are hidden", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    serve(detail());
    const { sheet } = await openRice();
    await within(sheet).findByText("22 days");
    expect(sheet.textContent).not.toMatch(/27[,.]90/);
    expect(sheet.textContent).not.toMatch(/24[,.]00/);
    expect(within(sheet).getByRole("img").getAttribute("aria-label")).toContain("hidden value");
  });

  it("asks Ran out from the sheet, closes it and marks the item", async () => {
    serve(detail());
    const { sheet } = await openRice();
    await userEvent.click(await within(sheet).findByRole("button", { name: "Ran out" }));
    await waitFor(() => expect(api.markRanOut).toHaveBeenCalledWith("p1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a write still pending", () => {
  it("cannot be asked Ran out again while its undo is in flight", async () => {
    serve(detail());
    vi.mocked(api.undoRanOut).mockReturnValue(new Promise(() => {}));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ran out: Arroz" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await userEvent.click(await screen.findByRole("button", { name: "Arroz" }));
    const button = await within(await screen.findByRole("dialog")).findByRole("button", { name: "Ran out" });
    expect(button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true").toBe(true);
    expect(api.markRanOut).toHaveBeenCalledTimes(1);
  });
});

describe("an item that cannot show numbers yet", () => {
  it("says never bought, with no zeros and no chart", async () => {
    serve(detail({ avgDurationDays: null, prices: [] }));
    const { sheet } = await openRice();
    expect(await within(sheet).findByText("Never bought")).toBeTruthy();
    expect(sheet.textContent).not.toContain("0,00");
    expect(sheet.textContent).not.toContain("0.00");
    expect(within(sheet).queryByRole("img")).toBeNull();
    expect(within(sheet).queryByText("Last price")).toBeNull();
  });

  it("explains the missing average when bought but never finished, and still shows the price", async () => {
    serve(detail({ avgDurationDays: null }));
    const { sheet } = await openRice();
    expect(await within(sheet).findByText(/Mark "Ran out" once/)).toBeTruthy();
    expect(within(sheet).queryByText(/days?$/)).toBeNull();
    expect(within(sheet).getByText("Last price")).toBeTruthy();
  });
});

describe("loading, failing and a deleted item", () => {
  it("shows a loading state, then an error with Retry that recovers", async () => {
    vi.mocked(api.getItem).mockRejectedValueOnce(new Error("down"));
    const { sheet } = await openRice();
    expect((await within(sheet).findByRole("alert")).textContent).toContain("Couldn't load the item.");
    expect(within(sheet).queryByText("Never bought")).toBeNull();
    serve(detail());
    await userEvent.click(within(sheet).getByRole("button", { name: "Retry" }));
    expect(await within(sheet).findByText("22 days")).toBeTruthy();
  });

  it("shows a loading state while it reads", async () => {
    vi.mocked(api.getItem).mockReturnValue(new Promise(() => {}));
    const { sheet } = await openRice();
    expect(within(sheet).getByLabelText("Loading the item")).toBeTruthy();
  });

  it("closes on a 404 and reads the Pantry again", async () => {
    vi.mocked(api.getItem).mockResolvedValue({ kind: "not-found" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Arroz" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(api.getPantry).toHaveBeenCalledTimes(2));
  });
});

describe("closing", () => {
  it("returns focus to the row's name button", async () => {
    serve(detail());
    const { sheet } = await openRice();
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Arroz" })));
  });

  it("still returns focus after an Edit sheet when the item's sheet vanished because the list changed", async () => {
    serve(detail());
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.mocked(api.getPantry).mockResolvedValueOnce([RICE, BEANS]).mockResolvedValue([BEANS]);
    await openRice();
    // Behind the open sheet: a refresh that no longer lists Arroz takes its sheet with it.
    fireEvent.click(within(screen.getByText("Feijão").closest("li")!).getByRole("button", { name: /Ran out/, hidden: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Feijão" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions for Feijão" })));
  });

  it("has no axe violations in pt-BR and English", async () => {
    serve(detail());
    for (const locale of ["pt-BR", "en"] as const) {
      const { sheet, unmount } = await openRice(locale);
      await within(sheet).findByRole("img");
      const { violations } = await axe.run(sheet, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(violations.map((v) => v.id)).toEqual([]);
      unmount();
    }
  });
});
