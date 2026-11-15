import { Amount } from "@homeowner/bedrock/finance";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "../domains/bills/api";
import type { Bill } from "../domains/bills/api";
import * as sourcesApi from "../domains/sources/api";
import { HideValuesToggle, HIDE_VALUES_STORAGE_KEY, useHiddenProps } from "../shared/HideValues";
import { MonthSelect } from "../shared/month/MonthSelect";
import { PageHeader } from "../shared/PageHeader";
import { renderApp } from "../testing";
import { Shell } from "./Shell";

vi.mock("../domains/bills/api", async (original) => ({ ...(await original<typeof import("../domains/bills/api")>()), getBills: vi.fn() }));
vi.mock("../domains/sources/api", async (original) => ({ ...(await original<typeof import("../domains/sources/api")>()), getSources: vi.fn() }));

const bill = (over: Partial<Bill>): Bill => ({ id: "b1", name: "Aluguel", expectedCents: 320000, dueDay: 5, dueDate: "2030-01-05", paid: false, paidBy: null, paidCents: null, ...over });
const status = (lastSyncedAt: string | null) => ({ sources: [], importing: false, lastSyncedAt });

// Mid-January 2030 in São Paulo.
const NOW = new Date("2030-01-10T15:00:00Z");

function Screen() {
  const { search } = useLocation();
  const hidden = useHiddenProps();
  return (
    <>
      <PageHeader title="Tela" subtitle="Sub" tools={<><MonthSelect /><HideValuesToggle /></>} />
      <Amount cents={12345} size="md" {...hidden} />
      <output data-testid="search">{search}</output>
    </>
  );
}

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Screen />} />
      </Route>
    </Routes>,
    { locale: "pt-BR", ...options },
  );

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  localStorage.clear();
  vi.mocked(billsApi.getBills).mockReset().mockResolvedValue([]);
  vi.mocked(sourcesApi.getSources).mockReset().mockResolvedValue(status(null));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sidebar", () => {
  it("has two named groups and Settings outside both", () => {
    open();
    const nav = screen.getByRole("navigation");
    const names = (g: string) => within(within(nav).getByRole("list", { name: g })).getAllByRole("link").map((a) => a.textContent);
    expect(names("Principal")).toEqual(["Visão geral", "Lançamentos", "Contas a pagar", "Faturas", "Categorias de gasto"]);
    expect(names("Planejamento")).toEqual(["Objetivos", "Patrimônio", "Projeção", "Fontes"]);
    expect(within(nav).getAllByRole("list")).toHaveLength(3);
  });

  it("counts the unpaid Bills of the month on Contas a pagar", async () => {
    vi.mocked(billsApi.getBills).mockResolvedValue([bill({}), bill({ id: "b2" }), bill({ id: "b3", paid: true, paidBy: "hand" })]);
    open();
    expect(await screen.findByRole("link", { name: "Contas a pagar, 2 para pagar" })).toBeTruthy();
    expect(billsApi.getBills).toHaveBeenCalledWith("2030-01");
  });

  it.each([
    ["none are unpaid", () => vi.mocked(billsApi.getBills).mockResolvedValue([bill({ paid: true, paidBy: "hand" })])],
    ["the read fails", () => vi.mocked(billsApi.getBills).mockRejectedValue(new Error("down"))],
  ])("shows no badge when %s", async (_, arrange) => {
    arrange();
    open();
    await waitFor(() => expect(billsApi.getBills).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r));
    expect(screen.getByRole("link", { name: "Contas a pagar" })).toBeTruthy();
  });

  it("says how long ago the banks were read", async () => {
    vi.mocked(sourcesApi.getSources).mockResolvedValue(status("2030-01-10T13:00:00Z"));
    open();
    expect(await screen.findByText("Atualizado há 2 h")).toBeTruthy();
  });
});

describe("hide values", () => {
  it("hides every Amount, saves the choice and keeps it on the next visit", async () => {
    const first = open();
    expect(screen.getByText(/123,45/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    expect(screen.getByText("valor escondido")).toBeTruthy();
    expect(localStorage.getItem(HIDE_VALUES_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "Mostrar valores" }).getAttribute("aria-pressed")).toBe("true");
    first.unmount();
    open();
    expect(screen.getByText("valor escondido")).toBeTruthy();
  });
});

describe("month in the URL", () => {
  it("is this month when the URL has none, and a bad month falls back to it", () => {
    open({ path: "/?month=2031-05" });
    expect(screen.getByRole("combobox", { name: "Mês" }).textContent).toContain("Janeiro de 2030");
  });

  it("writes a past month and clears the URL for this month", async () => {
    open();
    await userEvent.click(screen.getByRole("combobox", { name: "Mês" }));
    await userEvent.click(await screen.findByRole("option", { name: "Novembro de 2029" }));
    expect(screen.getByTestId("search").textContent).toBe("?month=2029-11");
    await userEvent.click(screen.getByRole("combobox", { name: "Mês" }));
    await userEvent.click(await screen.findByRole("option", { name: "Janeiro de 2030" }));
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("keeps a month older than the list", () => {
    open({ path: "/?month=2020-03" });
    expect(screen.getByRole("combobox", { name: "Mês" }).textContent).toContain("Março de 2020");
  });
});
