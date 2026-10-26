import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../../app/Layout";
import { EnvironmentSwitch } from "../../environment/EnvironmentSwitch";
import { mount } from "../../testing";
import type { Flow, FlowStep } from "./api";
import { FlowPage } from "./FlowPage";

const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ apiClient: { get } }));

const { render, container } = mount();

const IDS: [string, string?][] = [
  ["homesDue"],
  ["runs", "homesDue"],
  ["llmAsked", "runs"],
  ["llmSkipped", "runs"],
  ["llmAccepted", "llmAsked"],
  ["llmFallback", "llmAsked"],
  ["rejectedRuns", "runs"],
  ["explanationsLlm"],
  ["explanationsTemplate"],
  ["pushesDelivered"],
  ["pushesFailed"],
  ["pushesGone"],
  ["pushesUnknown"],
];

function flow(counts: Record<string, number>): Flow {
  const steps: FlowStep[] = IDS.map(([id, of]) => (of === undefined ? { id, count: counts[id] ?? 0 } : { id, count: counts[id] ?? 0, of }));
  return { range: "7d", from: "2026-10-19", to: "2026-10-25", steps };
}

function page(entry = "/flow?range=7d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <EnvironmentSwitch current="staging" urls={{ production: "https://admin.example.com" }} />
        <Routes>
          <Route element={<Layout />}>
            <Route path="flow" element={<FlowPage />} />
            <Route index element={<p>overview</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const text = () => container().textContent!;
const items = () => [...container().querySelectorAll("ol[aria-label] > li")];

beforeEach(() => {
  get.mockReset();
});

describe("FlowPage", () => {
  it("asks /admin/flow for the range and shows every step in order with its count and rate", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 100, runs: 80, llmAsked: 60, llmAccepted: 54, llmFallback: 6, pushesDelivered: 20 }) });
    await render(page("/flow?range=30d"));
    expect(get).toHaveBeenCalledWith("/admin/flow", { params: { range: "30d" } });
    expect(items()).toHaveLength(13);
    const labels = items().map((li) => li.querySelector("h2")!.textContent!);
    expect(labels[0]).toContain("Homes due (Homes that existed that day)");
    expect(labels[6]).toContain("Rejected runs (baseline refused by the referee)");
    expect(labels[9]).toContain("Pushes delivered (Day Plan ready, accepted by push service)");
    expect(items()[1].textContent).toContain("80");
    expect(items()[1].textContent).toContain("80% of Homes due");
    expect(items()[5].textContent).toContain("6 fell back (10%)");
  });

  it("marks the failing step with text and a named icon, and no other step", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 10, runs: 10, llmAsked: 5, llmAccepted: 5, pushesDelivered: 4, pushesFailed: 6 }) });
    await render(page());
    const flagged = items().filter((li) => li.textContent!.includes("Weakest step"));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].querySelector("h2")!.textContent).toContain("Pushes failed");
    expect(flagged[0].textContent).toContain("6 failed (60%)");
    expect(flagged[0].querySelector('svg[role="img"]')!.getAttribute("aria-label")).toBe("Warning");
    expect(flagged[0].className).toContain("border-4");
    expect(text().match(/Weakest step/g)).toHaveLength(1);
  });

  it("hides the bars from assistive technology", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 10, runs: 5 }) });
    await render(page());
    const bars = container().querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(13);
    for (const bar of bars) expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container().querySelectorAll<HTMLElement>("[data-bar]")[1].style.width).toBe("50%");
  });

  it("shows n/a for a zero reference, flags nothing and prints no NaN", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 0, runs: 3 }) });
    await render(page());
    expect(text()).toContain("n/a");
    expect(text()).not.toContain("Weakest step");
    expect(text()).not.toMatch(/NaN|Infinity/);
  });

  it("renders a step above its reference without a negative drop", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 10, runs: 12 }) });
    await render(page());
    expect(items()[1].textContent).toContain("120% of Homes due");
    expect(text()).not.toMatch(/-\d/);
    expect(text()).not.toContain("Weakest step");
  });

  it("says so when every step is 0", async () => {
    get.mockResolvedValue({ status: 200, data: flow({}) });
    await render(page());
    expect(text()).toContain("No pipeline activity in this range");
    expect(items()).toHaveLength(0);
    expect(text()).not.toContain("Weakest step");
  });

  it("shows a skeleton while loading", async () => {
    get.mockReturnValue(new Promise(() => {}));
    await render(page());
    expect(container().querySelector('[role="status"]')!.textContent).toContain("Loading the flow");
  });

  it("shows an error with a Retry that refetches", async () => {
    get.mockRejectedValueOnce(new Error("boom"));
    const tree = page();
    await render(tree);
    expect(container().querySelector('[role="alert"]')!.textContent).toContain("could not be loaded");
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 1 }) });
    const retry = [...container().querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    await render(tree);
    expect(get).toHaveBeenCalledTimes(2);
    expect(container().querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the range in the nav links and the environment switch", async () => {
    get.mockResolvedValue({ status: 200, data: flow({ homesDue: 1 }) });
    await render(page("/flow?range=30d"));
    const hrefs = [...container().querySelectorAll<HTMLAnchorElement>("nav a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/flow?range=30d");
    expect(hrefs).toContain("/?range=30d");
    expect(container().querySelector<HTMLAnchorElement>('a[href^="https://admin.example.com"]')!.getAttribute("href")).toBe(
      "https://admin.example.com/flow?range=30d",
    );
  });
});
