import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_ROWS } from "../../app/screens";
import { HideValuesProvider } from "../../shared/HideValues";
import { renderApp } from "../../testing";
import * as goalsApi from "../goals/api";
import * as netWorthApi from "../net-worth/api";
import * as overviewApi from "../overview/api/api";
import * as sourcesApi from "../sources/api";
import { PlanPage } from "./PlanPage";

vi.mock("../goals/api", async (original) => ({ ...(await original<typeof import("../goals/api")>()), getSavings: vi.fn() }));
vi.mock("../net-worth/api", async (original) => ({ ...(await original<typeof import("../net-worth/api")>()), getNetWorth: vi.fn() }));
vi.mock("../overview/api/api", async (original) => ({ ...(await original<typeof import("../overview/api/api")>()), getCommitments: vi.fn() }));
vi.mock("../sources/api", async (original) => ({ ...(await original<typeof import("../sources/api")>()), getSources: vi.fn() }));

// Mid-January 2030 in São Paulo.
const NOW = new Date("2030-01-10T15:00:00Z");
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const goal = (id: string, savedCents: number, targetCents: number) => ({ id, name: id, targetCents, targetMonth: null, savedCents, monthCents: 0, expectedMonth: null, late: false });
const SAVINGS = {
  reserveTargetCents: null, contributionBaseCents: 150000, reserveSharePercent: 30,
  reserve: { targetCents: null, savedCents: 0, monthCents: 0, expectedMonth: null },
  goals: [goal("a", 100000, 400000), goal("b", 300000, 600000)], investments: [], unassignedCents: 0,
} as unknown as goalsApi.Savings;
const NET_WORTH: netWorthApi.NetWorth = {
  hasData: true, today: { totalCents: 1850000, balancesCents: 1850000, investmentsCents: 0, cardBillsCents: 0 }, series: [], seriesExcludesCardBills: true,
  monthStart: { day: "2029-12-31", balancesCents: 1000000, investmentsCents: 0 }, monthChange: { balancesCents: 302000, investmentsCents: 0, totalCents: 302000 },
};
const months = (leftover: (number | undefined)[]) =>
  ({ monthlyIncomeCents: 500000, months: leftover.map((leftoverCents, i) => ({ month: `2030-0${i + 1}`, leftoverCents })) }) as unknown as overviewApi.Commitments;
const status = (reconnect: boolean): sourcesApi.SourcesStatus => ({
  sources: [], items: [{ id: "i1", bankName: "Itaú", status: reconnect ? "reconnect" : "ok", products: 1 }], importing: false, lastSyncedAt: null,
});

const open = (options: Parameters<typeof renderApp>[1] = {}) => renderApp(<HideValuesProvider><PlanPage rows={PLAN_ROWS} /></HideValuesProvider>, { path: "/plan", locale: "pt-BR", ...options });
const rows = () => within(screen.getByRole("list")).getAllByRole("link");

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  vi.mocked(goalsApi.getSavings).mockReset().mockResolvedValue(SAVINGS);
  vi.mocked(netWorthApi.getNetWorth).mockReset().mockResolvedValue(NET_WORTH);
  vi.mocked(overviewApi.getCommitments).mockReset().mockResolvedValue(months([100, -160000, -5]));
  vi.mocked(sourcesApi.getSources).mockReset().mockResolvedValue(status(true));
});
afterEach(() => vi.useRealTimers());

describe("Planejar", () => {
  it("has the title, the subtitle, the eye and the four rows in order, each a link to its screen", async () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Planejar" })).toBeTruthy();
    expect(screen.getByText("Para onde o dinheiro vai nos próximos meses")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Esconder valores" })).toBeTruthy();
    expect(rows()).toHaveLength(4);
    expect(rows().map((a) => a.getAttribute("href"))).toEqual(["/goals", "/net-worth", "/projection", "/sources"]);
    expect(rows().map((a) => within(a).getAllByText(/./)[0]!.textContent)).toEqual(["Objetivos", "Patrimônio", "Projeção", "Fontes"]);
  });

  it("says where each one stands", async () => {
    open();
    const [goals, worth, projection, sources] = rows() as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    await waitFor(() => expect(goals.textContent).toContain("40%"));
    expect(goals.textContent).toMatch(/Aporte de R\$\s1\.500,00 por mês/);
    await waitFor(() => expect(worth.textContent).toMatch(/\+R\$\s3\.020,00 em janeiro/));
    expect(worth.textContent).toMatch(/R\$\s18\.500,00/);
    await waitFor(() => expect(projection.textContent).toMatch(/Fevereiro fica R\$\s1\.600,00 no vermelho/));
    expect(projection.textContent).toContain("Falta");
    await waitFor(() => expect(sources.textContent).toContain("Itaú pediu nova autorização"));
    expect(sources.textContent).toContain("Reconectar");
  });

  it("names no bank when the one to reconnect has no name", async () => {
    vi.mocked(sourcesApi.getSources).mockResolvedValue({ ...status(true), items: [{ id: "i1", bankName: null, status: "reconnect", products: 1 }] });
    open();
    await waitFor(() => expect(rows()[3]!.textContent).toContain("Um banco pediu nova autorização"));
  });

  it("leaves a row with no badge when nothing is short and no bank asks to reconnect", async () => {
    vi.mocked(overviewApi.getCommitments).mockResolvedValue(months([100, undefined]));
    vi.mocked(sourcesApi.getSources).mockResolvedValue(status(false));
    open();
    await waitFor(() => expect(goalsApi.getSavings).toHaveBeenCalled());
    await waitFor(() => expect(rows()[0]!.textContent).toContain("40%"));
    await new Promise((r) => setTimeout(r));
    expect(rows()[2]!.textContent).toBe("Projeção");
    expect(rows()[3]!.textContent).toBe("Fontes");
  });

  it("shows only the title of a row whose read fails, with no error", async () => {
    vi.mocked(goalsApi.getSavings).mockRejectedValue(new Error("down"));
    vi.mocked(netWorthApi.getNetWorth).mockRejectedValue(new Error("down"));
    open();
    await waitFor(() => expect(rows()[2]!.textContent).toContain("Falta"));
    expect(rows()[0]!.textContent).toBe("Objetivos");
    expect(rows()[1]!.textContent).toBe("Patrimônio");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides every amount with the toggle", async () => {
    open();
    await waitFor(() => expect(rows()[2]!.textContent).toContain("Fevereiro"));
    await waitFor(() => expect(rows()[1]!.textContent).toMatch(/18\.500,00/));
    await userEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    expect(screen.getByRole("list").textContent).not.toMatch(/\d[.,]\d{2}/);
    expect(rows()[2]!.textContent).toContain("Fevereiro fica no vermelho");
  });

  it("has no accessibility violations", async () => {
    open();
    await waitFor(() => expect(rows()[3]!.textContent).toContain("Reconectar"));
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });
});
