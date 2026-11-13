import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { Source, SourcesStatus } from "./api";
import type { PluggyOptions } from "./logic/pluggyConnect";
import { SourcesPage } from "./SourcesPage";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getSources: vi.fn(), createConnectToken: vi.fn(), registerItem: vi.fn(), putSourceName: vi.fn() }));
let widget: PluggyOptions;
vi.mock("./logic/pluggyConnect", () => ({ openPluggyConnect: vi.fn(async (o: PluggyOptions) => void (widget = o)) }));

const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const base = { bankName: "Itaú", currency: "BRL", closeDay: null, dueDay: null };
const CHECKING: Source = { ...base, id: "s1", name: "Itaú", kind: "checking", balanceCents: 123_456, balanceOn: "2026-11-08" };
const NEVER: Source = { ...base, id: "s2", name: "Poupança Itaú", kind: "savings" };
const CARD: Source = { ...base, id: "s3", name: "Nubank", bankName: "Nubank", kind: "credit_card", closeDay: 8, dueDay: 15 };
const status = (sources: Source[], over: Partial<SourcesStatus> = {}): SourcesStatus => ({ sources, importing: false, lastSyncedAt: "2026-11-08T13:05:00Z", ...over });

beforeEach(() => {
  vi.mocked(api.getSources).mockResolvedValue(status([CHECKING, NEVER, CARD]));
  vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "ok", connectToken: "tok", includeSandbox: false });
});

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/settings" element={<p>settings page</p>} />
    </Routes>,
    { path: "/sources", locale: "en", ...options },
  );
const item = async (name: string) => (await screen.findByRole("heading", { name })).closest("li")!;

describe("balances", () => {
  it("shows the balance with its day for a bank account", async () => {
    open();
    const row = await item("Itaú");
    expect(within(row).getByText(/1,234\.56/)).toBeTruthy();
    expect(within(row).getByText("updated on Nov 8, 2026")).toBeTruthy();
  });

  it("says 'no balance yet', not zero, for a bank account never synced", async () => {
    open();
    const row = await item("Poupança Itaú");
    expect(within(row).getByText("no balance yet")).toBeTruthy();
    expect(row.textContent).not.toMatch(/0,00|0\.00/);
  });

  it("shows no balance line for a card, and its bill days", async () => {
    open();
    const row = await item("Nubank");
    expect(within(row).queryByText(/no balance yet|updated on/)).toBeNull();
    expect(within(row).getByText("Closes on day 8 · due on day 15")).toBeTruthy();
  });

  it("writes the day in Portuguese by default", async () => {
    open({ locale: "pt-BR" });
    expect(await screen.findByText("atualizado em 8 de nov. de 2026")).toBeTruthy();
    expect(screen.getByText("sem saldo ainda")).toBeTruthy();
  });
});

describe("states", () => {
  it("invites the first connection when there are no Sources", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([], { lastSyncedAt: null }));
    open();
    expect(await screen.findByText("No Sources yet. Connect a bank to start.")).toBeTruthy();
  });

  it("offers Try again when the list fails to load", async () => {
    vi.mocked(api.getSources).mockRejectedValueOnce(new Error("down"));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Itaú" })).toBeTruthy();
  });

  it("says when the banks are importing", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING], { importing: true }));
    open();
    expect(await screen.findByText("Importing your transactions…")).toBeTruthy();
  });

  it("shows when it last synced", async () => {
    open();
    expect(await screen.findByText(/^Last synced /)).toBeTruthy();
  });
});

describe("connecting", () => {
  it("opens Pluggy Connect and shows the new Source once the Item is registered", async () => {
    vi.mocked(api.getSources).mockResolvedValue(status([]));
    vi.mocked(api.registerItem).mockResolvedValue({ kind: "ok", status: status([CHECKING]) });
    open();
    // The refresh after registering reads what the API now holds.
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING]));
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    expect(widget).toMatchObject({ connectToken: "tok", includeSandbox: false });
    await widget.onSuccess({ item: { id: "item-1" } });
    expect(api.registerItem).toHaveBeenCalledWith("item-1");
    expect(await screen.findByRole("heading", { name: "Itaú" })).toBeTruthy();
  });

  it("says nothing was connected when the widget is closed", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    widget.onClose();
    expect(await screen.findByText(/Nothing was connected/)).toBeTruthy();
  });

  it.each([
    [{ kind: "unavailable" }, "Pluggy did not answer just now. Try again later."],
    [{ kind: "offline" }, "Cannot reach the service. Check your connection and try again."],
    [{ kind: "rejected" }, "Pluggy did not accept your credentials. Replace them in Settings."],
  ] as const)("words the token failure %j", async (token, text) => {
    vi.mocked(api.createConnectToken).mockResolvedValue(token);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    expect(await screen.findByText(new RegExp(text.slice(0, 30)))).toBeTruthy();
  });

  it("links to Settings, which owns the credentials form, when none are saved", async () => {
    vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "no-credentials" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await userEvent.click(await screen.findByRole("link", { name: "Open Settings" }));
    expect(screen.getByText("settings page")).toBeTruthy();
  });

  it("words a refused Item", async () => {
    vi.mocked(api.registerItem).mockResolvedValue({ kind: "item-refused" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await waitFor(() => expect(widget).toBeDefined());
    await widget.onSuccess({ item: { id: "i" } });
    expect(await screen.findByText(/Pluggy could not connect that bank/)).toBeTruthy();
  });
});

describe("naming", () => {
  it("renames a Source and shows the new name", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    const field = screen.getByLabelText("Name");
    await userEvent.clear(field);
    await userEvent.type(field, "  Cartão roxo ");
    vi.mocked(api.getSources).mockResolvedValue(status([CHECKING, NEVER, { ...CARD, name: "Cartão roxo" }]));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.putSourceName).toHaveBeenCalledWith("s3", "Cartão roxo");
    expect(await screen.findByRole("heading", { name: "Cartão roxo" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Rename Cartão roxo" })).toBe(document.activeElement));
  });

  it("refuses an empty name without calling the API", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(api.putSourceName).not.toHaveBeenCalled();
  });

  it("shows the API's word for a name that is too long", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "fields", fields: { name: "too_long" } });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Nubank" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Use up to 60 characters.")).toBeTruthy();
  });

  it("sends null to go back to the bank's name", async () => {
    vi.mocked(api.putSourceName).mockResolvedValue({ kind: "ok" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Rename Poupança Itaú" }));
    await userEvent.click(screen.getByRole("button", { name: "Use the bank's name" }));
    expect(api.putSourceName).toHaveBeenCalledWith("s2", null);
  });
});

describe("accessibility", () => {
  it.each([
    ["en", "light"],
    ["en", "dark"],
    ["pt-BR", "light"],
    ["pt-BR", "dark"],
  ] as const)("has no violations in %s, %s theme", async (locale, theme) => {
    const { container } = open({ locale, theme });
    await screen.findByRole("heading", { name: "Nubank" });
    await userEvent.click(screen.getAllByRole("button")[0]!);
    expect((await axe.run(container, AXE)).violations).toEqual([]);
  });

  it("has none in the failure and empty states", async () => {
    vi.mocked(api.createConnectToken).mockResolvedValue({ kind: "no-credentials" });
    const { container } = open();
    await userEvent.click(await screen.findByRole("button", { name: "Connect banks" }));
    await screen.findByRole("link", { name: "Open Settings" });
    expect((await axe.run(container, AXE)).violations).toEqual([]);
  });
});
