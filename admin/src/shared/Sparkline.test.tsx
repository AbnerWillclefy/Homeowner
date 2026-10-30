import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { Sparkline } from "./Sparkline";

const { render, container } = mount();

const image = () => container().querySelector('[role="img"]')!;
const line = () => container().querySelector<SVGPathElement>("path.recharts-line-curve");

describe("Sparkline", () => {
  it("is an image with the label as its text alternative, and hides the chart inside it", async () => {
    await render(<Sparkline values={[1, 3, 2]} label="Fallbacks per day: 1 to 2, highest 3" />);
    expect(image().getAttribute("aria-label")).toBe("Fallbacks per day: 1 to 2, highest 3");
    expect(image().querySelector("svg")).not.toBeNull();
    expect(line()).not.toBeNull();
  });

  it("draws a flat line for all zeros, with no NaN anywhere", async () => {
    await render(<Sparkline values={[0, 0, 0, 0]} label="flat" />);
    expect(container().innerHTML).not.toContain("NaN");
    expect(line()).not.toBeNull();
  });

  it("breaks the line at a null day", async () => {
    await render(<Sparkline values={[1, 2, null, 3, 4]} label="gap" />);
    expect(line()!.getAttribute("d")!.match(/M/g)).toHaveLength(2);
  });

  it("marks a day standing alone between gaps with a dot, so it is not lost", async () => {
    await render(<Sparkline values={[null, 3, null]} label="one" />);
    expect(container().querySelectorAll("[data-lone-day]")).toHaveLength(1);
    expect(container().innerHTML).not.toContain("NaN");
  });

  it("draws no line when there is nothing to plot", async () => {
    await render(<Sparkline values={[null, null]} label="none" />);
    expect(line()?.getAttribute("d") ?? "").not.toContain("L");
    expect(image().getAttribute("aria-label")).toBe("none");
  });
});
