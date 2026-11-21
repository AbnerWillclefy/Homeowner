import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MORE_ROWS } from "../../app/screens";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as billsApi from "../bills/api";
import type { Bill } from "../bills/api";
import * as categoriesApi from "../categories/api";
import * as overviewApi from "../overview/api/api";
import * as pantryApi from "../pantry/api";
import type { PantryItem } from "../pantry/api";
import * as sourcesApi from "../sources/api";
import { MorePage } from "./MorePage";

vi.mock("../bills/api", async (original) => ({ ...(await original<typeof import("../bills/api")>()), getBills: vi.fn() }));
vi.mock("../categories/api", async (original) => ({ ...(await original<typeof import("../categories/api")>()), getSpending: vi.fn() }));
vi.mock("../overview/api/api", async (original) => ({ ...(await original<typeof import("../overview/api/api")>()), getCommitments: vi.fn() }));
vi.mock("../pantry/api", async (original) => ({ ...(await original<typeof import("../pantry/api")>()), getPantry: vi.fn() }));
vi.mock("../sources/api", async (original) => ({ ...(await original<typeof import("../sources/api")>()), getSources: vi.fn() }));

// Mid-January 2030 in São Paulo.
const NOW = new Date("2030-01-10T15:00:00Z");
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const bill = (over: Partial<Bill>): Bill => ({ id: "b1", name: "Aluguel", expectedCents: 320000, dueDay: 29, dueDate: "2030-01-29", paid: false, paidBy: null, paidCents: null, ...over });
const item = (over: Partial<PantryItem>): PantryItem => ({ id: "p1", name: "Arroz", preferredBrand: null, fixed: false, state: "ran_out", ranOutOn: "2030-01-08", ...over });
const tx = (id: string, categorySetBy: string) =>
  ({ id, postedOn: "2030-01-05", description: "Pix", sourceName: "Nubank", amountCents: -4500, type: "expense", spendingCategory: "other", categorySetBy }) as categoriesApi.Spending["transactions"][number];
const commitments = (cards: number[]) =>
  ({ monthlyIncomeCents: 500000, months: [{ month: "2030-01", cards: cards.map((amountCents, i) => ({ sourceId: `c${i}`, name: `C${i}`, amountCents, billDaysKnown: true })) }] }) as unknown as overviewApi.Commitments;

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<HideValuesProvider><MorePage rows={MORE_ROWS} /></HideValuesProvider>, { path: "/more", locale: "pt-BR", ...options });
const links = () => screen.getAllByRole("link");
const row = (title: string) => links().find((a) => a.textContent!.startsWith(title))!;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  vi.mocked(billsApi.getBills).mockReset().mockResolvedValue([bill({}), bill({ id: "b2", dueDate: "2030-01-12", expectedCents: 50000 }), bill({ id: "b3", paid: true, paidBy: "hand" })]);
  vi.mocked(categoriesApi.getSpending).mockReset().mockResolvedValue({ categories: [], limits: {}, transactions: [tx("t1", "fallback"), tx("t2", "auto")] });
  vi.mocked(overviewApi.getCommitments).mockReset().mockResolvedValue(commitments([300000, 153300]));
  vi.mocked(pantryApi.getPantry).mockReset().mockResolvedValue([item({}), item({ id: "p2" }), item({ id: "p3", state: "in_stock", ranOutOn: null })]);
  vi.mocked(sourcesApi.getSources).mockReset().mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: "2030-01-10T13:00:00Z" });
});
afterEach(() => vi.useRealTimers());

describe("Mais", () => {
  it("has the title, the eye, the four rows then Configurações in a card of its own, each a link to its screen", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Mais" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Esconder valores" })).toBeTruthy();
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[0]!).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/bills", "/card-bills", "/categories", "/pantry"]);
    expect(within(lists[1]!).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/settings"]);
    expect(links()).toHaveLength(5);
    expect(links().map((a) => a.textContent)).toEqual(["Contas a pagar", "Faturas", "Categorias de gasto", "Despensa", "Configurações" + "Renda, aporte, tema e avisos"]);
  });

  it("says where each one stands, with the Bills badge, and the note at the foot", async () => {
    open();
    await waitFor(() => expect(row("Contas a pagar").textContent).toContain("2 pendentes"));
    expect(row("Contas a pagar").textContent).toMatch(/R\$\s3\.700,00 até 12 de Jan\./);
    await waitFor(() => expect(row("Faturas").textContent).toMatch(/R\$\s4\.533,00 em faturas abertas/));
    await waitFor(() => expect(row("Categorias de gasto").textContent).toBe("Categorias de gasto1 sem categoria1"));
    await waitFor(() => expect(row("Despensa").textContent).toContain("2 itens acabando"));
    expect(await screen.findByText("Atualizado há 2 h")).toBeTruthy();
  });

  it("uses the singular for one pending Bill and one item, and says all paid when none is left", async () => {
    vi.mocked(billsApi.getBills).mockResolvedValue([bill({}), bill({ id: "b3", paid: true, paidBy: "hand" })]);
    vi.mocked(pantryApi.getPantry).mockResolvedValue([item({})]);
    open();
    await waitFor(() => expect(row("Contas a pagar").textContent).toContain("1 pendente"));
    expect(row("Contas a pagar").textContent).not.toContain("pendentes");
    await waitFor(() => expect(row("Despensa").textContent).toContain("1 item acabando"));
  });

  it("says all paid, and draws no badge, when no Bill is left to pay", async () => {
    vi.mocked(billsApi.getBills).mockResolvedValue([bill({ paid: true, paidBy: "hand" })]);
    open();
    await waitFor(() => expect(row("Contas a pagar").textContent).toContain("Tudo pago"));
    expect(row("Contas a pagar").textContent).not.toContain("pendente");
  });

  it("leaves a row with only its title when nothing is to say, and when a read fails, with no error", async () => {
    vi.mocked(categoriesApi.getSpending).mockResolvedValue({ categories: [], limits: {}, transactions: [tx("t2", "auto")] });
    vi.mocked(pantryApi.getPantry).mockResolvedValue([item({ state: "in_stock", ranOutOn: null })]);
    vi.mocked(overviewApi.getCommitments).mockRejectedValue(new Error("down"));
    open();
    await waitFor(() => expect(row("Contas a pagar").textContent).toContain("pendentes"));
    await new Promise((r) => setTimeout(r));
    expect(row("Categorias de gasto").textContent).toBe("Categorias de gasto");
    expect(row("Despensa").textContent).toBe("Despensa");
    expect(row("Faturas").textContent).toBe("Faturas");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no note before the banks were read", async () => {
    vi.mocked(sourcesApi.getSources).mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: null });
    open();
    await waitFor(() => expect(sourcesApi.getSources).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r));
    expect(screen.queryByText(/Atualizado/)).toBeNull();
  });

  it("hides every amount with the toggle", async () => {
    open();
    await waitFor(() => expect(row("Contas a pagar").textContent).toMatch(/3\.700,00/));
    await waitFor(() => expect(row("Faturas").textContent).toMatch(/4\.533,00/));
    await userEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    for (const a of links()) expect(a.textContent).not.toMatch(/\d[.,]\d{2}/);
    expect(row("Contas a pagar").textContent).toContain("Até 12 de Jan.");
    expect(row("Faturas").textContent).toContain("Faturas abertas");
  });

  it("has no accessibility violations", async () => {
    open();
    await waitFor(() => expect(row("Despensa").textContent).toContain("acabando"));
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });
});
