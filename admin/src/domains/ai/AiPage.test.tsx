import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../../app/Layout";
import { mount } from "../../testing";
import type { AiDay, AiUsage, ServiceDay } from "./api";
import { AiPage } from "./AiPage";

const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ apiClient: { get } }));

const { render, container } = mount();

function service(over: Partial<ServiceDay> = {}): ServiceDay {
  return {
    outcomes: { accepted: 0, rejected_by_referee: 0, invalid_response: 0, timeout: 0, error: 0, skipped_cap: 0, skipped_budget: 0 },
    latencyP50Ms: null,
    latencyMaxMs: null,
    inputTokens: 0,
    outputTokens: 0,
    estCostMicros: 0,
    uncostedCalls: 0,
    ...over,
  };
}

function day(n: number, allocator: Partial<ServiceDay> = {}, explainer: Partial<ServiceDay> = {}): AiDay {
  return { date: `2026-10-${String(n).padStart(2, "0")}`, services: { allocator: service(allocator), explainer: service(explainer) } };
}

function usage(days: AiDay[], over: Partial<AiUsage> = {}): AiUsage {
  return {
    range: "7d",
    from: days[0].date,
    to: days[days.length - 1].date,
    costIsEstimate: true,
    days,
    monthToDate: { month: "2026-10", estCostMicros: 2_500_000, uncostedCalls: 0, limitMicros: 10_000_000 },
    dailyCapPerHome: 3,
    allocatorShare: { llm: 6, baseline: 2 },
    explanationShare: {
      llm: 9,
      template: 3,
      templateReasons: { rejected_by_referee: 0, invalid_response: 0, timeout: 1, error: 0, skipped_cap: 0, skipped_budget: 0, partial: 0, notAsked: 2 },
    },
    topViolationKinds: [{ kind: "over_energy", count: 4 }, { kind: "brand_new_kind", count: 1 }],
    topFallbackReasons: [{ reason: "llm_timeout", count: 2 }],
    ...over,
  };
}

const week = (f: (n: number) => AiDay = (n) => day(n)) => Array.from({ length: 7 }, (_, i) => f(i + 1));

function page(entry = "/ai?range=7d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="ai" element={<AiPage />} />
            <Route index element={<p>overview</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const text = () => container().textContent!;

beforeEach(() => {
  get.mockReset();
});

describe("AiPage", () => {
  it("asks /admin/ai for the range and shows every section with an h2", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    await render(page("/ai?range=30d"));
    expect(get).toHaveBeenCalledWith("/admin/ai", { params: { range: "30d" } });
    const headings = [...container().querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual([
      "Cost this month (estimated)",
      "Calls per day",
      "Who planned the day",
      "Who wrote the explanation",
      "Why the referee said no",
    ]);
    expect(text()).toContain("Up to 3 model calls per Home per day");
    expect(text()).toContain("75%");
    for (const table of container().querySelectorAll("table")) expect(table.querySelector("caption")).not.toBeNull();
  });

  it("puts each outcome count in its own column", async () => {
    const days = week((n) =>
      n === 2
        ? day(n, { outcomes: { accepted: 11, rejected_by_referee: 12, invalid_response: 13, timeout: 14, error: 15, skipped_cap: 16, skipped_budget: 17 } })
        : day(n),
    );
    get.mockResolvedValue({ status: 200, data: usage(days) });
    await render(page());
    const table = container().querySelector("table")!;
    const heads = [...table.querySelectorAll("thead th")].map((h) => h.textContent);
    const cells = [...table.querySelectorAll("tbody tr")[1].querySelectorAll("td")].map((c) => c.textContent);
    const at = (label: string) => cells[heads.indexOf(label) - 1];
    expect(at("Accepted")).toBe("11");
    expect(at("Rejected by referee")).toBe("12");
    expect(at("Invalid answer")).toBe("13");
    expect(at("Timeout")).toBe("14");
    expect(at("Error")).toBe("15");
    expect(at("Skipped: cap")).toBe("16");
    expect(at("Skipped: budget")).toBe("17");
  });

  it("formats latency, tokens and cost in the table", async () => {
    const days = week((n) =>
      n === 1 ? day(n, { outcomes: { ...service().outcomes, accepted: 1 }, latencyP50Ms: 420, latencyMaxMs: 2500, inputTokens: 1234567, outputTokens: 89, estCostMicros: 4_560 }) : day(n),
    );
    get.mockResolvedValue({ status: 200, data: usage(days) });
    await render(page());
    const row = [...container().querySelector("table")!.querySelectorAll("tbody tr")[0].querySelectorAll("td")].map((c) => c.textContent);
    expect(row.slice(7)).toEqual(["420 ms", "2.5 s", "1,234,567", "89", "$0.0046"]);
    const second = [...container().querySelector("table")!.querySelectorAll("tbody tr")[1].querySelectorAll("td")].map((c) => c.textContent);
    expect(second.slice(7, 9)).toEqual(["n/a", "n/a"]);
  });

  it("labels every money figure as estimated and names the Console as the source of truth", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week((n) => day(n, { outcomes: { ...service().outcomes, accepted: 1 }, estCostMicros: 5_000 }))) });
    await render(page());
    expect(text()).toContain("$2.50 of $10.00 limit, estimated");
    expect(text()).toContain("Cost (estimated)");
    expect(text()).toContain("The Anthropic Console is the source of truth for the bill.");
    const link = container().querySelector<HTMLAnchorElement>('a[href="https://console.anthropic.com"]')!;
    expect(link.target).toBe("_blank");
    expect(link.textContent).toContain("opens in a new tab");
  });

  it("flags calls without a price only when there are some", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week((n) => (n === 3 ? day(n, { outcomes: { ...service().outcomes, accepted: 2 }, uncostedCalls: 2 }) : day(n)))) });
    await render(page());
    expect(text()).toContain("+2 calls without a price");
    expect(text()).toContain("Calls without a price (an unknown model");
  });

  it("shows no flag when every call has a price", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week((n) => day(n, { outcomes: { ...service().outcomes, accepted: 1 } }))) });
    await render(page());
    expect(text()).not.toContain("without a price");
  });

  it("says over or under the limit in words, not only colour", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    await render(page());
    expect(text()).toContain("Under the limit");
    expect(text()).not.toContain("Over the limit");
    expect(container().querySelector<HTMLElement>("[data-month-bar]")!.style.width).toBe("25%");
  });

  it("states the over case in text and caps the bar", async () => {
    get.mockResolvedValue({
      status: 200,
      data: usage(week(), { monthToDate: { month: "2026-10", estCostMicros: 12_000_000, uncostedCalls: 0, limitMicros: 10_000_000 } }),
    });
    await render(page());
    expect(text()).toContain("Over the limit");
    expect(text()).toContain("$12.00 of $10.00 limit, estimated");
    expect(container().querySelector<HTMLElement>("[data-month-bar]")!.style.width).toBe("100%");
  });

  it("shows no bar when no limit is configured", async () => {
    get.mockResolvedValue({
      status: 200,
      data: usage(week(), { monthToDate: { month: "2026-10", estCostMicros: 1_000_000, uncostedCalls: 0, limitMicros: null } }),
    });
    await render(page());
    expect(text()).toContain("No monthly limit configured");
    expect(text()).toContain("$1.00 estimated");
    expect(container().querySelector("[data-month-bar]")).toBeNull();
  });

  it("shows the raw id with a gloss, and the raw id alone for an unknown one", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    await render(page());
    expect(text()).toContain("over_energy");
    expect(text()).toContain("a Resident was given more than their energy");
    expect(text()).toContain("brand_new_kind");
    expect(text()).toContain("llm_timeout");
    expect(text()).toContain("cap reached");
    expect(text()).toContain("not asked (rest day or LLM off)");
  });

  it("shows the empty line but keeps the month section when every count is 0", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    await render(page());
    expect(text()).toContain("No model calls in this range");
    expect(text()).toContain("Cost this month (estimated)");
    expect(container().querySelector("#calls ~ div table, #calls table")).toBeNull();
  });

  it("shows a skeleton while loading", async () => {
    get.mockReturnValue(new Promise(() => {}));
    await render(page());
    expect(container().querySelector('[role="status"]')).not.toBeNull();
    expect(container().querySelectorAll("tbody tr")).toHaveLength(14);
  });

  it("shows an error with a Retry that refetches", async () => {
    get.mockRejectedValueOnce(new Error("boom"));
    const tree = page();
    await render(tree);
    expect(container().querySelector('[role="alert"]')!.textContent).toContain("could not be loaded");
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    const retry = [...container().querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    await render(tree);
    expect(get).toHaveBeenCalledTimes(2);
    expect(container().querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the range in the nav links", async () => {
    get.mockResolvedValue({ status: 200, data: usage(week()) });
    await render(page("/ai?range=30d"));
    const hrefs = [...container().querySelectorAll<HTMLAnchorElement>("nav a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/?range=30d");
    expect(hrefs).toContain("/ai?range=30d");
  });
});
