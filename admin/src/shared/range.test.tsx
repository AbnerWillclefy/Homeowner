import { act } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { config } from "../config";
import { EnvironmentSwitch } from "../environment/EnvironmentSwitch";
import { mount } from "../testing";
import { barPercent, parseRange, useRange } from "./range";
import { RangeControl } from "./RangeControl";

const { render, container } = mount();

describe("parseRange", () => {
  it("accepts 7d and 30d only", () => {
    expect(parseRange("7d")).toBe("7d");
    expect(parseRange("30d")).toBe("30d");
    for (const bad of [null, "", "90d", "7D", "7"]) expect(parseRange(bad)).toBeNull();
  });
});

describe("barPercent", () => {
  it("is proportional, and zero with no maximum", () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
  });
});

function Probe() {
  const [range, setRange] = useRange();
  const { search } = useLocation();
  return (
    <>
      <output data-testid="range">{range}</output>
      <output data-testid="search">{search}</output>
      <RangeControl value={range} onChange={setRange} />
      <EnvironmentSwitch current="staging" urls={config.adminUrls} />
    </>
  );
}

const text = (id: string) => container().querySelector(`[data-testid="${id}"]`)!.textContent;

describe("useRange", () => {
  it("falls back to 7d for an invalid value and rewrites the URL", async () => {
    await render(
      <MemoryRouter initialEntries={["/?range=90d&x=1"]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(text("range")).toBe("7d");
    expect(text("search")).toBe("?range=7d&x=1");
  });

  it("keeps the other parameters when switching, and the environment switch carries the range", async () => {
    await render(
      <MemoryRouter initialEntries={["/?range=7d&x=1"]}>
        <Probe />
      </MemoryRouter>,
    );
    const thirty = container().querySelector<HTMLInputElement>('input[value="30d"]')!;
    await act(async () => thirty.click());
    expect(text("range")).toBe("30d");
    expect(text("search")).toBe("?range=30d&x=1");
    expect(container().querySelector("a")!.getAttribute("href")).toBe(
      "https://admin.example.com/?range=30d&x=1",
    );
  });
});

describe("RangeControl", () => {
  it("is a fieldset with a Range legend and radios, the selected one checked and marked in text", async () => {
    await render(<RangeControl value="30d" onChange={() => {}} />);
    expect(container().querySelector("fieldset > legend")!.textContent).toBe("Range");
    const radios = [...container().querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.checked)).toEqual([false, true]);
    expect(container().textContent).toContain("✓ 30 days");
  });
});
