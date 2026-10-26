import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "../../testing";
import type { Overview, OverviewDay } from "./api";
import { OverviewPage } from "./OverviewPage";

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

function overview(days: OverviewDay[], range: "7d" | "30d" = "7d"): Overview {
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

beforeEach(() => {
  get.mockReset();
});

describe("OverviewPage", () => {
  it("asks /admin/overview for the range, and shows totals, active counts and a row per day with proportional bars", async () => {
    get.mockResolvedValue({ status: 200, data: overview(sevenDays((n) => ({ checkins: n === 2 ? 4 : n === 5 ? 2 : 0 }))) });
    await render(page("/?range=7d"));

    expect(get).toHaveBeenCalledWith("/admin/overview", { params: { range: "7d" } });
    const text = container().textContent!;
    for (const label of ["Users", "Homes", "Residents", "Chores", "Active Homes", "Active Residents"]) {
      expect(text).toContain(label);
    }
    expect(container().querySelectorAll("tbody tr")).toHaveLength(7);
    expect(text).not.toContain("No activity in this range");
    const widths = [...container().querySelectorAll<HTMLElement>("[data-bar]")].map((b) => b.style.width);
    expect(widths).toEqual(["100%", "50%"]);
  });

  it("asks for 30 days from the URL and shows the glossary labels", async () => {
    get.mockResolvedValue({
      status: 200,
      data: overview(Array.from({ length: 30 }, (_, i) => day(i + 1)), "30d"),
    });
    await render(page("/?range=30d"));
    expect(get).toHaveBeenCalledWith("/admin/overview", { params: { range: "30d" } });
    expect(container().querySelectorAll("tbody tr")).toHaveLength(30);
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
  });

  it("shows an error with a Retry button that refetches", async () => {
    get.mockRejectedValueOnce(new Error("boom"));
    await render(page());
    expect(container().querySelector('[role="alert"]')!.textContent).toContain("could not be loaded");
    get.mockResolvedValue({ status: 200, data: overview(sevenDays()) });
    const retry = [...container().querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    await render(page());
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("shows the table with zeros and one line when every count is 0", async () => {
    get.mockResolvedValue({ status: 200, data: overview(sevenDays()) });
    await render(page());
    expect(container().textContent).toContain("No activity in this range");
    expect(container().querySelectorAll("tbody tr")).toHaveLength(7);
    expect(container().querySelectorAll("[data-bar]")).toHaveLength(0);
    const cells = [...container().querySelectorAll("tbody td")].map((c) => c.textContent);
    expect(cells.every((c) => c === "0")).toBe(true);
  });

  it("reads each table cell as its number, so a screen reader never needs the bars", async () => {
    get.mockResolvedValue({ status: 200, data: overview(sevenDays((n) => ({ runs: n === 3 ? 6 : 0 }))) });
    await render(page());
    const row = container().querySelectorAll("tbody tr")[2];
    expect(row.querySelector("th")!.textContent).toBe("2026-10-03");
    expect(row.querySelectorAll("td")[0].textContent).toBe("6");
    expect(container().querySelector("[data-bar]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders only numbers and dates: no @ and no string that is not in the fixture's numbers or dates", async () => {
    const full = sevenDays((n) => ({
      runs: n, rejected: n, fallbacks: n, checkins: n, completions: n, refuses: n, takes: n, swapsAccepted: n,
      pushes: { delivered: n, failed: n, gone: n, unknown: n },
    }));
    // Extra fields a buggy API might add must never reach the page, because the page reads only typed fields.
    const leaky = { ...overview(full), email: "ana@example.com", name: "Ana Souza", choreTitle: "Wash dishes" };
    get.mockResolvedValue({ status: 200, data: leaky });
    await render(page());
    const text = container().textContent!;
    expect(text).not.toContain("@");
    for (const secret of ["ana", "Souza", "Wash dishes"]) expect(text).not.toContain(secret);
    const cells = [...container().querySelectorAll("tbody td")].map((c) => c.textContent!);
    expect(cells.every((c) => /^\d+$/.test(c))).toBe(true);
    const heads = [...container().querySelectorAll("tbody th")].map((c) => c.textContent!);
    expect(heads.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))).toBe(true);
  });
});
