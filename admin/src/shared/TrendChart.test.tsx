import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { TrendChart, trendLabel } from "./TrendChart";

const { render, container } = mount();

const dates = ["2026-10-01", "2026-10-02", "2026-10-03"];

describe("trendLabel", () => {
  it("gives each series its total and its highest day", () => {
    expect(
      trendLabel("Activity per day", dates, [
        { label: "Runs", values: [1, 4, 2] },
        { label: "Check-ins", values: [0, 0, 3] },
      ]),
    ).toBe("Activity per day, last 3 days. Runs: 7 in total, highest 4 on 2026-10-02. Check-ins: 3 in total, highest 3 on 2026-10-03.");
  });

  it("says none for a series of zeros, never a highest day", () => {
    expect(trendLabel("Calls", dates, [{ label: "Explainer", values: [0, 0, 0] }])).toBe("Calls, last 3 days. Explainer: none.");
  });
});

describe("TrendChart", () => {
  it("shows its title and a legend as text, and carries the summary as the image's text alternative", async () => {
    await render(<TrendChart title="Activity per day" dates={dates} series={[{ label: "Runs", values: [1, 4, 2] }]} />);
    const image = container().querySelector('[role="img"]')!;
    expect(image.getAttribute("aria-label")).toBe("Activity per day, last 3 days. Runs: 7 in total, highest 4 on 2026-10-02.");
    expect(container().querySelector("figcaption")!.textContent).toBe("Activity per day");
    expect(container().textContent).toContain("Runs");
  });

  it("keeps the chart out of the tab order, since the image's text alternative and the table carry the numbers", async () => {
    await render(<TrendChart title="Activity per day" dates={dates} series={[{ label: "Runs", values: [1, 4, 2] }]} />);
    const svg = container().querySelector('[role="img"] svg')!;
    expect(svg.hasAttribute("tabindex")).toBe(false);
    expect(svg.getAttribute("role")).not.toBe("application");
  });

  it("refuses more series than it has line styles, with an error that says so", async () => {
    const four = ["A", "B", "C", "D"].map((label) => ({ label, values: [1, 2, 3] }));
    await expect(render(<TrendChart title="Too many" dates={dates} series={four} />)).rejects.toThrow("at most 3 series");
  });
});
