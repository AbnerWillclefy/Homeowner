import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "../../testing";
import type { Overview, OverviewDay } from "./api";
import { OverviewPage } from "./OverviewPage";
import type { Worth, WorthCounts, WorthDay } from "./worth";

const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ apiClient: { get } }));

const { render, container } = mount();

function day(n: number, over: Partial<OverviewDay> = {}): OverviewDay {
  return {
    date: `2026-10-${String(n).padStart(2, "0")}`,
    runs: 0, rejected: 0, fallbacks: 0, checkins: 0, completions: 0, refuses: 0, takes: 0, swapsAccepted: 0,
    pushes: { delivered: 0, failed: 0, gone: 0, unknown: 0 },
    ...over,
  };
}

function overview(days: OverviewDay[], { range = "7d" }: { range?: "7d" | "30d" } = {}): Overview {
  return {
    range,
    from: days[0].date,
    to: days[days.length - 1].date,
    totals: { users: 11, homes: 4, residents: 9, chores: 23 },
    active: { homes: 3, residents: 7 },
    days,
  };
}

const sevenDays = (over: (n: number) => Partial<OverviewDay> = () => ({})) =>
  Array.from({ length: 7 }, (_, i) => day(i + 1, over(i + 1)));

const zeroCounts = (): WorthCounts => ({
  outcome: {
    llm: { proposed: 0, completed: 0, refused: 0 },
    baseline: { proposed: 0, completed: 0, refused: 0 },
  },
  reliability: { runsLlm: 0, runsFallback: 0, runsLlmNotAsked: 0, allocatorCalls: 0, refereeRejected: 0 },
  cost: { allocatorCostMicros: 0, uncostedCalls: 0 },
  explanations: { llm: 0, template: 0 },
});

/** LLM arm 40 proposed (75% completed, 10% refused), baseline 30 (60%, 20%); 20% fallbacks; 10% rejections. */
const busyCounts = (): WorthCounts => ({
  outcome: {
    llm: { proposed: 40, completed: 30, refused: 4 },
    baseline: { proposed: 30, completed: 18, refused: 6 },
  },
  reliability: { runsLlm: 8, runsFallback: 2, runsLlmNotAsked: 3, allocatorCalls: 10, refereeRejected: 1 },
  cost: { allocatorCostMicros: 8000, uncostedCalls: 0 },
  explanations: { llm: 6, template: 4 },
});

function worth(
  current: WorthCounts,
  { range = "7d", previous, monthToDate }: { range?: "7d" | "30d"; previous?: WorthCounts; monthToDate?: Worth["monthToDate"] } = {},
): Worth {
  const n = range === "30d" ? 30 : 7;
  const days: WorthDay[] = Array.from({ length: n }, (_, i) => ({ ...current, date: `2026-10-${String(i + 1).padStart(2, "0")}` }));
  return {
    range,
    from: days[0].date,
    to: days[n - 1].date,
    costIsEstimate: true,
    current,
    previous: previous && { ...previous, from: "2026-09-01", to: "2026-09-07" },
    days,
    monthToDate: monthToDate ?? { month: "2026-10", estCostMicros: 2_000_000, uncostedCalls: 0, limitMicros: 10_000_000 },
  };
}

type Answer = unknown | Error;
const respond = (answer: Answer) =>
  answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ status: 200, data: answer });

/** Answers each URL on its own, so one report can fail while the other loads. */
function serve({ overview: o, worth: w }: { overview?: Answer; worth?: Answer }) {
  get.mockImplementation((url: string) => {
    if (url === "/admin/overview") return respond(o ?? overview(sevenDays()));
    if (url === "/admin/worth") return respond(w ?? worth(busyCounts()));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function page(entry = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <OverviewPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const headline = () => container().querySelector<HTMLElement>("[data-worth]")!;
const dayRows = () => container().querySelectorAll("[data-collapsible-region] tbody tr");
const dayCells = () => [...container().querySelectorAll("[data-collapsible-region] tbody td")].map((c) => c.textContent!);
const card = (name: string) => headline().querySelector<HTMLElement>(`[data-card="${name}"]`)!;

beforeEach(() => {
  get.mockReset();
});

describe("OverviewPage", () => {
  it("asks /admin/overview for the range, and shows totals, active counts and a row per day with proportional bars", async () => {
    serve({ overview: overview(sevenDays((n) => ({ checkins: n === 2 ? 4 : n === 5 ? 2 : 0 }))) });
    await render(page("/?range=7d"));

    expect(get).toHaveBeenCalledWith("/admin/overview", { params: { range: "7d" } });
    const text = container().textContent!;
    for (const label of ["Users", "Homes", "Residents", "Chores", "Active Homes", "Active Residents"]) {
      expect(text).toContain(label);
    }
    expect(dayRows()).toHaveLength(7);
    expect(text).not.toContain("No activity in this range");
    const widths = [...container().querySelectorAll<HTMLElement>("[data-bar]")].map((b) => b.style.width);
    expect(widths).toEqual(["100%", "50%"]);
  });

  it("asks for 30 days from the URL and shows the glossary labels", async () => {
    serve({
      overview: overview(Array.from({ length: 30 }, (_, i) => day(i + 1)), { range: "30d" }),
      worth: worth(busyCounts(), { range: "30d" }),
    });
    await render(page("/?range=30d"));
    expect(get).toHaveBeenCalledWith("/admin/overview", { params: { range: "30d" } });
    expect(dayRows()).toHaveLength(30);
    const text = container().textContent!;
    expect(text).toContain("Refuses (lower bound)");
    expect(text).toContain("Pushes accepted by push service");
    expect(text).toContain("sent before tracking, or dropped at the deadline");
  });

  it("shows a skeleton with the right row count while loading", async () => {
    get.mockReturnValue(new Promise(() => {}));
    await render(page("/?range=30d"));
    expect(container().querySelector('[role="status"]')).not.toBeNull();
    expect(container().querySelectorAll("tbody tr")).toHaveLength(30);
    expect(headline().textContent).toContain("Loading");
  });

  it("shows an error with a Retry button that refetches", async () => {
    get.mockImplementation((url: string) =>
      url === "/admin/overview" ? Promise.reject(new Error("boom")) : respond(worth(busyCounts())),
    );
    // One tree and one QueryClient throughout: rendering the same element again only waits, it does not remount.
    const tree = page();
    await render(tree);
    expect(container().textContent).toContain("The overview could not be loaded");
    serve({});
    const retry = [...container().querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    await render(tree);
    expect(container().querySelector('[role="alert"]')).toBeNull();
    expect(container().textContent).toContain("Active Homes");
  });

  it("shows the table with zeros and one line when every count is 0", async () => {
    serve({ overview: overview(sevenDays()) });
    await render(page());
    expect(container().textContent).toContain("No activity in this range");
    expect(dayRows()).toHaveLength(7);
    expect(container().querySelectorAll("[data-bar]")).toHaveLength(0);
    expect(dayCells().every((c) => c === "0")).toBe(true);
  });

  it("reads each table cell as its number, so a screen reader never needs the bars", async () => {
    serve({ overview: overview(sevenDays((n) => ({ runs: n === 3 ? 6 : 0 }))) });
    await render(page());
    const row = dayRows()[2];
    expect(row.querySelector("th")!.textContent).toBe("2026-10-03");
    expect(row.querySelectorAll("td")[0].textContent).toBe("6");
    expect(container().querySelector("[data-bar]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the Per day table inside a collapsed region, still in the document", async () => {
    serve({});
    await render(page());
    const region = container().querySelector<HTMLElement>("[data-collapsible-region]")!;
    expect(region.hidden).toBe(true);
    expect(region.querySelector("table")).not.toBeNull();
    const toggle = container().querySelector("button[aria-controls]")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("per-day table");
  });

  it("renders only numbers and dates in the per-day table: no @ and no leaked field", async () => {
    const full = sevenDays((n) => ({
      runs: n, rejected: n, fallbacks: n, checkins: n, completions: n, refuses: n, takes: n, swapsAccepted: n,
      pushes: { delivered: n, failed: n, gone: n, unknown: n },
    }));
    // Extra fields a buggy API might add must never reach the page, because the page reads only typed fields.
    const leakyOverview = { ...overview(full), email: "ana@example.com", name: "Ana Souza", choreTitle: "Wash dishes" };
    const leakyWorth = { ...worth(busyCounts()), email: "ana@example.com", name: "Ana Souza", choreTitle: "Wash dishes" };
    serve({ overview: leakyOverview, worth: leakyWorth });
    await render(page());
    const text = container().textContent!;
    expect(text).not.toContain("@");
    for (const secret of ["ana@example", "Ana Souza", "Wash dishes"]) expect(text).not.toContain(secret);
    expect(dayCells().every((c) => /^\d+$/.test(c))).toBe(true);
    const heads = [...container().querySelectorAll("[data-collapsible-region] tbody th")].map((c) => c.textContent!);
    expect(heads.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))).toBe(true);
  });

  it("only reads: the page makes GET calls and nothing else", async () => {
    serve({});
    await render(page());
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("worth headline", () => {
  it("opens the page, above Totals, with the four measures", async () => {
    serve({});
    await render(page());
    const totals = container().querySelector("#totals")!;
    expect(headline().compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/admin/worth", { params: { range: "7d" } });
    for (const name of ["outcome", "reliability", "cost", "explanations"]) expect(card(name)).not.toBeNull();
    expect(headline().textContent).toContain("Is the AI worth it?");
  });

  it("asks /admin/worth again for 30 days when the range is switched", async () => {
    serve({});
    await render(page("/?range=7d"));
    const thirty = container().querySelector<HTMLInputElement>('input[value="30d"]')!;
    await act(async () => thirty.click());
    await render(page("/?range=7d"));
    expect(get).toHaveBeenCalledWith("/admin/worth", { params: { range: "30d" } });
  });

  describe("outcome", () => {
    it("compares the arms side by side with n per arm, and says it is observational with a lower-bound Refuse rate", async () => {
      serve({});
      await render(page());
      const outcome = card("outcome");
      const heads = [...outcome.querySelectorAll("thead th")].map((c) => c.textContent);
      expect(heads).toEqual(["Measure", "LLM", "Baseline"]);
      const rows = [...outcome.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent));
      expect(rows[0]).toEqual(["Completion rate", "75%", "60%"]);
      expect(rows[1][0]).toContain("Refuse rate");
      expect(rows[1].slice(1)).toEqual(["10%", "20%"]);
      expect(rows[2]).toEqual(["Proposed Tasks (n)", "40", "30"]);
      expect(outcome.textContent).toContain("Observational, not an A/B test");
      expect(outcome.textContent).toContain("Refuse rate is a lower bound");
    });

    it("says Not enough data for the arm under 20 proposed Tasks only", async () => {
      const counts = busyCounts();
      counts.outcome.baseline = { proposed: 5, completed: 5, refused: 0 };
      serve({ worth: worth(counts) });
      await render(page());
      const rows = [...card("outcome").querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent));
      expect(rows[0]).toEqual(["Completion rate", "75%", "Not enough data"]);
      expect(rows[1].slice(1)).toEqual(["10%", "Not enough data"]);
      expect(rows[2]).toEqual(["Proposed Tasks (n)", "40", "5"]);
    });

    it("shows the change in points against the previous range, and none when the previous range is under 20 Tasks", async () => {
      const previous = busyCounts();
      previous.outcome.llm = { proposed: 40, completed: 20, refused: 4 }; // 50%: now 75%, so +25 pp
      previous.outcome.baseline = { proposed: 2, completed: 1, refused: 0 };
      serve({ worth: worth(busyCounts(), { previous }) });
      await render(page());
      const rows = [...card("outcome").querySelectorAll("tbody tr")];
      expect(rows[0].children[1].textContent).toContain("+25 pp");
      expect(rows[0].children[2].textContent).not.toContain("pp");
    });

    it("draws a sparkline per arm with a text alternative", async () => {
      serve({});
      await render(page());
      const labels = [...card("outcome").querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute("aria-label")!);
      expect(labels.length).toBeGreaterThanOrEqual(2);
      expect(labels.every((l) => l.length > 0)).toBe(true);
      expect(labels.some((l) => l.includes("LLM"))).toBe(true);
      expect(labels.some((l) => l.includes("Baseline"))).toBe(true);
    });
  });

  describe("reliability", () => {
    it("shows the LLM share against the fallback share, leaving out the runs where the LLM was not asked", async () => {
      serve({});
      await render(page());
      const text = card("reliability").textContent!;
      expect(text).toContain("80%");
      expect(text).toContain("20%");
      expect(text).toContain("3 runs where the LLM was not asked are excluded");
    });

    it("shows the ok badges for a healthy sample", async () => {
      const counts = busyCounts();
      counts.reliability = { runsLlm: 90, runsFallback: 10, runsLlmNotAsked: 0, allocatorCalls: 100, refereeRejected: 5 };
      serve({ worth: worth(counts) });
      await render(page());
      const text = card("reliability").textContent!;
      expect(text).toContain("Fallback share normal");
      expect(text).toContain("Rejections normal");
    });

    it("shows the bad badge, with its text, at a fallback share of 50%", async () => {
      const counts = busyCounts();
      counts.reliability = { runsLlm: 10, runsFallback: 10, runsLlmNotAsked: 0, allocatorCalls: 20, refereeRejected: 0 };
      serve({ worth: worth(counts) });
      await render(page());
      expect(card("reliability").textContent).toContain("Fallback share high");
    });

    it("is neutral, Not enough data, under 20 allocator calls", async () => {
      serve({});
      await render(page());
      expect(card("reliability").textContent).toContain("Not enough data");
    });
  });

  describe("cost", () => {
    it("shows the estimated cost per LLM-planned Allocation, month to date against the limit, and the explainer note", async () => {
      serve({ worth: worth(busyCounts(), { monthToDate: { month: "2026-10", estCostMicros: 9_000_000, uncostedCalls: 0, limitMicros: 10_000_000 } }) });
      await render(page());
      const text = card("cost").textContent!;
      expect(text).toContain("$0.0010"); // 8000 micros over 8 LLM-planned runs
      expect(text).toContain("Estimated");
      expect(text).toContain("$9.00");
      expect(text).toContain("$10.00");
      expect(text).toContain("this calendar month");
      expect(text).toContain("Near the limit");
      expect(text).toContain("Explainer cost is not included");
      expect(card("cost").querySelector("a")!.getAttribute("href")).toBe("/ai?range=7d");
    });

    it("says it is a lower bound when some calls have no estimate, and n/a with no LLM-planned Allocation", async () => {
      const counts = busyCounts();
      counts.cost.uncostedCalls = 2;
      counts.reliability.runsLlm = 0;
      serve({ worth: worth(counts, { monthToDate: { month: "2026-10", estCostMicros: 0, uncostedCalls: 0, limitMicros: null } }) });
      await render(page());
      const text = card("cost").textContent!;
      expect(text).toContain("n/a");
      expect(text).toContain("lower bound");
      expect(text).toContain("No limit set");
    });
  });

  describe("explanation share", () => {
    it("shows the LLM share against the template share, with a sparkline and no badge", async () => {
      serve({});
      await render(page());
      const c = card("explanations");
      expect(c.textContent).toContain("60%");
      expect(c.textContent).toContain("40%");
      expect(c.querySelector('svg[role="img"]')!.getAttribute("aria-label")).toContain("per day");
    });
  });

  describe("states", () => {
    it("shows an alert with Retry when /admin/worth fails, while the per-day table still loads", async () => {
      serve({ worth: new Error("boom") });
      await render(page());
      expect(headline().querySelector('[role="alert"]')!.textContent).toContain("could not be loaded");
      expect(container().querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(dayRows()).toHaveLength(7);
      expect(container().textContent).toContain("Active Homes");
    });

    it("keeps the headline when /admin/overview fails", async () => {
      serve({ overview: new Error("boom") });
      await render(page());
      expect(container().textContent).toContain("The overview could not be loaded");
      expect(headline().querySelector('[role="alert"]')).toBeNull();
      expect(card("outcome").textContent).toContain("75%");
    });

    it("never shows NaN or Infinity for a range with no data, and says so", async () => {
      serve({ worth: worth(zeroCounts()) });
      await render(page());
      const text = headline().textContent!;
      expect(text).not.toMatch(/NaN|Infinity/);
      expect(text).toContain("No data in this range");
      expect(text).toContain("n/a");
      expect(text).toContain("Not enough data");
    });

    it("shows no change and does not crash when previous is missing", async () => {
      serve({});
      await render(page());
      expect(headline().textContent).not.toContain("vs previous");
    });
  });
});
