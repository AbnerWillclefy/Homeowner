import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Shell } from "../../app/Shell";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { PantryItem, WriteResult } from "./api";
import { PantryPage } from "./PantryPage";

// jsdom lacks pointer capture, which Radix Toast reads on pointer events.
Element.prototype.hasPointerCapture ??= () => false;
// Radix Checkbox, inside the item form, measures its hidden input with it.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getPantry: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(), markRanOut: vi.fn(), undoRanOut: vi.fn(),
}));
vi.mock("../bills/api", async (original) => ({ ...(await original<typeof import("../bills/api")>()), getBills: vi.fn().mockResolvedValue([]) }));
vi.mock("../sources/api", async (original) => ({ ...(await original<typeof import("../sources/api")>()), getSources: vi.fn().mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: null }) }));

const item = (over: Partial<PantryItem>): PantryItem => ({ id: "p1", name: "Arroz", preferredBrand: null, fixed: false, state: "in_stock", ranOutOn: null, ...over });
const RICE = item({ preferredBrand: "Tio João", fixed: true });
const BEANS = item({ id: "p2", name: "Feijão" });
const MILK = item({ id: "p3", name: "Leite", state: "ran_out", ranOutOn: "2030-01-08" });
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const serve = (items: PantryItem[]) => vi.mocked(api.getPantry).mockResolvedValue(items);
const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<PantryPage />, { path: "/pantry", locale: "en", ...options });
const ok: WriteResult = { kind: "ok" };
const row = (name: string) => screen.getByText(name).closest("li")!;
const ranOut = vi.mocked(api.markRanOut);
const undo = vi.mocked(api.undoRanOut);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") });
  localStorage.clear();
  width(true);
  for (const fn of [api.getPantry, api.addItem, api.updateItem, api.deleteItem, api.markRanOut, api.undoRanOut]) vi.mocked(fn).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("layout and states", () => {
  it("lists items in their groups, on five and seven columns of one grid", async () => {
    serve([BEANS, MILK, RICE]);
    open();
    const out = await screen.findByRole("list", { name: "Items that ran out" });
    const stock = screen.getByRole("list", { name: "Items in the pantry" });
    expect(within(out).getAllByRole("listitem").map((r) => r.querySelector(".body-strong")!.textContent)).toEqual(["Leite"]);
    expect(within(stock).getAllByRole("listitem").map((r) => r.querySelector(".body-strong")!.textContent)).toEqual(["Arroz", "Feijão"]);
    const grid = document.querySelector(".desktop\\:grid-cols-12")!;
    expect(grid.children[0]!.className).toContain("desktop:col-span-5");
    expect(grid.children[1]!.className).toContain("desktop:col-span-7");
    expect(within(grid.children[1] as HTMLElement).getByRole("textbox", { name: "New item" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Pantry" })).toBeTruthy();
  });

  it("says how long ago an item ran out, its brand, and the always-buy mark", async () => {
    serve([RICE, MILK]);
    open();
    await screen.findByText("Arroz");
    expect(within(row("Leite")).getByText("ran out 2 days ago")).toBeTruthy();
    expect(within(row("Leite")).getByText("Ran out")).toBeTruthy();
    expect(within(row("Arroz")).getByText("Tio João")).toBeTruthy();
    expect(within(row("Arroz")).getByText("always buy")).toBeTruthy();
    expect(within(row("Leite")).queryByText("always buy")).toBeNull();
  });

  it("says ran out today, and one day ago, in pt-BR", async () => {
    serve([item({ name: "Café", state: "ran_out", ranOutOn: "2030-01-10" }), item({ id: "p4", name: "Sal", state: "ran_out", ranOutOn: "2030-01-09" })]);
    open({ locale: "pt-BR" });
    await screen.findByText("Café");
    expect(within(row("Café")).getByText("acabou hoje")).toBeTruthy();
    expect(within(row("Sal")).getByText("acabou há 1 dia")).toBeTruthy();
  });

  it.each([
    [[item({ state: "ran_out", ranOutOn: "2030-01-09" })], "1 item · 1 ran out"],
    [[RICE, BEANS, MILK], "3 items · 1 ran out"],
    [[RICE, BEANS], "2 items · 0 ran out"],
  ])("counts the items in the subtitle (%#)", async (items, text) => {
    serve(items);
    open();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("says an empty Pantry calmly and still offers the add field", async () => {
    serve([]);
    open({ locale: "pt-BR" });
    expect(await screen.findByText("Despensa vazia")).toBeTruthy();
    expect(screen.getByText("0 itens")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Novo item" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelector(".desktop\\:grid-cols-12")!.children[0]!.className).toContain("desktop:col-span-12");
  });

  it("shows a loading state", () => {
    vi.mocked(api.getPantry).mockReturnValue(new Promise(() => {}));
    open();
    expect(screen.getAllByLabelText("Loading the pantry")).toHaveLength(2);
  });

  it("shows an error with Retry, never the empty state, and recovers", async () => {
    vi.mocked(api.getPantry).mockRejectedValueOnce(new Error("down")).mockResolvedValue([RICE]);
    open();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't load the pantry.");
    expect(screen.queryByText("Pantry is empty")).toBeNull();
    expect(document.querySelector(".desktop\\:grid-cols-12")!.children[0]!.className).toContain("desktop:col-span-12");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Arroz")).toBeTruthy();
  });

  it("keeps the list when a background read fails", async () => {
    serve([RICE]);
    const { client } = open();
    await screen.findByText("Arroz");
    vi.mocked(api.getPantry).mockRejectedValue(new Error("down"));
    await client.invalidateQueries({ queryKey: ["finance", "pantry"] });
    await waitFor(() => expect(api.getPantry).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Arroz")).toBeTruthy();
    expect(screen.queryByText("Couldn't load the pantry.")).toBeNull();
  });
});

describe("ran out and undo", () => {
  it("moves the item at once, offers Undo, and reads the Pantry again", async () => {
    serve([RICE, BEANS]);
    let answer!: (r: WriteResult) => void;
    ranOut.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { client } = open();
    await screen.findByText("Arroz");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(screen.getByRole("button", { name: "Ran out: Feijão" }));
    expect(ranOut).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Items that ran out" })).getByText("Feijão")).toBeTruthy());
    answer(ok);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance", "pantry"] }));
    expect(await screen.findByText("Feijão ran out")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("undo puts the item back in stock", async () => {
    serve([BEANS]);
    ranOut.mockResolvedValue(ok);
    undo.mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ran out: Feijão" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Items in the pantry" })).getByText("Feijão")).toBeTruthy());
    expect(screen.getByText("Nothing ran out.")).toBeTruthy();
  });

  it("rolls the item back and says so when the API refuses, with no Undo offered", async () => {
    serve([BEANS]);
    ranOut.mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ran out: Feijão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    expect(within(screen.getByRole("list", { name: "Items in the pantry" })).getByText("Feijão")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("rolls an undo back too", async () => {
    // The read after the run-out answers with the item ran out.
    vi.mocked(api.getPantry).mockResolvedValueOnce([BEANS]).mockResolvedValue([{ ...BEANS, state: "ran_out", ranOutOn: "2030-01-10" }]);
    ranOut.mockResolvedValue(ok);
    undo.mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ran out: Feijão" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Items that ran out" })).getByText("Feijão")).toBeTruthy());
  });

  it("says the item is gone when the API cannot find it", async () => {
    serve([BEANS]);
    ranOut.mockResolvedValue({ kind: "not-found" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ran out: Feijão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no longer here");
  });

  it("writes a second item's run-out while the first is still pending", async () => {
    serve([RICE, BEANS]);
    ranOut.mockReturnValue(new Promise(() => {}));
    open();
    await screen.findByText("Arroz");
    await userEvent.click(screen.getByRole("button", { name: "Ran out: Arroz" }));
    await userEvent.click(screen.getByRole("button", { name: "Ran out: Feijão" }));
    expect(ranOut.mock.calls).toEqual([["p1"], ["p2"]]);
    const out = within(screen.getByRole("list", { name: "Items that ran out" }));
    expect(out.getByText("Arroz")).toBeTruthy();
    expect(out.getByText("Feijão")).toBeTruthy();
  });
});

describe("add, edit and delete", () => {
  it("adds an item by name only, and clears the field", async () => {
    serve([RICE]);
    vi.mocked(api.addItem).mockResolvedValue(ok);
    open();
    await userEvent.type(await screen.findByRole("textbox", { name: "New item" }), "  Sal ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(api.addItem).toHaveBeenCalledWith("Sal");
    await waitFor(() => expect((screen.getByRole("textbox", { name: "New item" }) as HTMLInputElement).value).toBe(""));
  });

  it("checks the name in the form, and keeps it with the reason when the API says it is taken", async () => {
    serve([RICE]);
    vi.mocked(api.addItem).mockResolvedValue({ kind: "fields", fields: { name: "taken" } });
    open();
    const field = await screen.findByRole("textbox", { name: "New item" });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Give the item a name.")).toBeTruthy();
    await userEvent.type(field, "x".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Use up to 60 letters.")).toBeTruthy();
    expect(api.addItem).not.toHaveBeenCalled();
    await userEvent.clear(field);
    await userEvent.type(field, "Arroz");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("An item with this name already exists.")).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe("Arroz");
  });

  it("says a failed add and keeps the typed name", async () => {
    serve([RICE]);
    vi.mocked(api.addItem).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.type(await screen.findByRole("textbox", { name: "New item" }), "Sal");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/We could not save/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "New item" }) as HTMLInputElement).value).toBe("Sal");
  });

  const edit = async (name: string) => {
    await userEvent.click(screen.getByRole("button", { name: `More actions for ${name}` }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    return within(await screen.findByRole("dialog"));
  };

  it("renames an item and sets its brand and always-buy mark, then returns focus to its row", async () => {
    serve([BEANS]);
    vi.mocked(api.updateItem).mockResolvedValue(ok);
    open();
    await screen.findByText("Feijão");
    const sheet = await edit("Feijão");
    const name = sheet.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Feijão preto");
    await userEvent.type(sheet.getByRole("textbox", { name: "Preferred brand" }), "Camil");
    await userEvent.click(sheet.getByRole("checkbox", { name: "Always buy" }));
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    expect(api.updateItem).toHaveBeenCalledWith("p2", { name: "Feijão preto", preferredBrand: "Camil", fixed: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row("Feijão").querySelector("button:last-of-type")));
  });

  it("clears the always-buy mark and the brand", async () => {
    serve([RICE]);
    vi.mocked(api.updateItem).mockResolvedValue(ok);
    open();
    await screen.findByText("Arroz");
    const sheet = await edit("Arroz");
    await userEvent.clear(sheet.getByRole("textbox", { name: "Preferred brand" }));
    await userEvent.click(sheet.getByRole("checkbox", { name: "Always buy" }));
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    expect(api.updateItem).toHaveBeenCalledWith("p1", { name: "Arroz", preferredBrand: null, fixed: false });
  });

  it("stays open with what was typed and the reason inside when the save is refused", async () => {
    serve([RICE, BEANS]);
    vi.mocked(api.updateItem).mockResolvedValueOnce({ kind: "fields", fields: { name: "taken" } }).mockResolvedValueOnce({ kind: "error" });
    open();
    await screen.findByText("Arroz");
    const sheet = await edit("Feijão");
    const name = sheet.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Arroz");
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    expect(await sheet.findByText("An item with this name already exists.")).toBeTruthy();
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    expect((await sheet.findByRole("alert")).textContent).toContain("We could not save");
    expect((name as HTMLInputElement).value).toBe("Arroz");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("checks the 60-letter limit on the name and the brand in the sheet", async () => {
    serve([BEANS]);
    open();
    await screen.findByText("Feijão");
    const sheet = await edit("Feijão");
    await userEvent.type(sheet.getByRole("textbox", { name: "Name" }), "x".repeat(60));
    await userEvent.type(sheet.getByRole("textbox", { name: /Preferred brand/ }), "y".repeat(61));
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    expect(sheet.getAllByText("Use up to 60 letters.")).toHaveLength(2);
    expect(api.updateItem).not.toHaveBeenCalled();
  });

  it("deletes an item only after confirming", async () => {
    serve([BEANS]);
    vi.mocked(api.deleteItem).mockResolvedValue(ok);
    open();
    await screen.findByText("Feijão");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Feijão" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Feijão leaves the pantry, with its history.")).toBeTruthy();
    expect(api.deleteItem).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(api.deleteItem).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Feijão" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(api.deleteItem).toHaveBeenCalledWith("p2");
  });

  it("says so when a delete fails", async () => {
    serve([BEANS]);
    vi.mocked(api.deleteItem).mockResolvedValue({ kind: "error" });
    open();
    await screen.findByText("Feijão");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Feijão" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save");
  });
});

describe("Mais", () => {
  it("opens from More on a phone, and is not in the bottom bar", async () => {
    width(false);
    serve([RICE]);
    renderApp(<Routes><Route element={<Shell />}><Route path="/pantry" element={<PantryPage />} /></Route></Routes>, { path: "/pantry", locale: "pt-BR" });
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).queryByRole("link", { name: "Despensa" })).toBeNull();
    await userEvent.click(within(nav).getByRole("link", { name: "Mais" }));
    expect(within(await screen.findByRole("dialog")).getByRole("link", { name: "Despensa" })).toBeTruthy();
  });
});

describe("accessibility", () => {
  it.each(["pt-BR", "en"] as const)("has no axe violations in %s", async (locale) => {
    serve([RICE, BEANS, MILK]);
    open({ locale });
    await screen.findByText("Arroz");
    const { violations } = await axe.run(document.body, AXE);
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
});
