// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../../shared/i18n/I18nProvider";
import { Bar } from "./Bar";
import { CumulativeLine } from "./CumulativeLine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: React.ReactElement) {
  localStorage.setItem("homeowner.locale", "pt-BR");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(createElement(I18nProvider, null, node)));
  return container;
}

// Intl writes a no-break space after "R$"; compare on plain spaces.
const text = (el: Element) => (el.textContent ?? "").replace(/ /g, " ");

describe("Bar", () => {
  it("shows its label and amount as text and draws the fill at its share", () => {
    const c = render(createElement(Bar, { label: "Mercado", value: 25000, max: 100000 }));
    expect(text(c)).toContain("Mercado");
    expect(text(c)).toContain("R$ 250,00");
    expect(c.querySelector<HTMLElement>("[data-fill]")?.style.width).toBe("25%");
  });
  it("draws no fill for a negative value and still shows its amount", () => {
    const c = render(createElement(Bar, { label: "Estornos", value: -4000, max: 100000 }));
    expect(c.querySelector("[data-fill]")).toBeNull();
    expect(text(c)).toContain("-R$ 40,00");
  });
  it("tells the hatched series from the solid one by a pattern, not only a colour", () => {
    const solid = render(createElement(Bar, { label: "a", value: 1, max: 2 }));
    const hatched = render(createElement(Bar, { label: "b", value: 1, max: 2, variant: "hatched" }));
    expect(solid.querySelector<HTMLElement>("[data-fill]")?.style.backgroundImage).toBe("");
    expect(hatched.querySelector<HTMLElement>("[data-fill]")?.style.backgroundImage).toContain("repeating-linear-gradient");
  });
  it("places a marker on the same scale", () => {
    const c = render(createElement(Bar, { label: "a", value: 100, max: 400, markers: [300] }));
    expect(c.querySelector<HTMLElement>("[data-marker]")?.style.left).toBe("75%");
  });
});

describe("CumulativeLine", () => {
  const series = [
    { label: "Novembro", points: [0, 100, 250] },
    { label: "Outubro", points: [0, 80, 120, 300] },
  ];

  it("labels the image for screen readers with each series' final amount", () => {
    const c = render(createElement(CumulativeLine, { title: "Gasto", series }));
    const label = c.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "";
    expect(label).toContain("Gasto");
    expect(label.replace(/ /g, " ")).toContain("Novembro: R$ 2,50");
    expect(label.replace(/ /g, " ")).toContain("Outubro: R$ 3,00");
  });

  it("shows each final amount as text and draws one line per series", () => {
    const c = render(createElement(CumulativeLine, { title: "Gasto", series }));
    expect(c.querySelectorAll("polyline")).toHaveLength(2);
    expect(text(c)).toContain("R$ 2,50");
    expect(text(c)).toContain("R$ 3,00");
  });

  it("swaps to a table with the same numbers and back", () => {
    const c = render(createElement(CumulativeLine, { title: "Gasto", series }));
    const toggle = c.querySelector("button")!;
    const chartLabel = text(toggle);
    expect(toggle.hasAttribute("aria-pressed")).toBe(false);
    act(() => toggle.click());
    expect(text(toggle)).not.toBe(chartLabel);
    expect(c.querySelector('[role="img"]')).toBeNull();
    expect(c.querySelector("caption")?.textContent).toBe("Gasto");
    const rows = [...c.querySelectorAll("tbody tr")].map((r) => [...r.children].map(text));
    expect(rows).toHaveLength(4);
    expect(rows[2]).toEqual(["3", "R$ 2,50", "R$ 1,20"]);
    expect(rows[3]).toEqual(["4", "–", "R$ 3,00"]);
    act(() => toggle.click());
    expect(c.querySelector('[role="img"]')).not.toBeNull();
  });

  it("still draws and shows R$ 0,00 for a single day of zero", () => {
    const c = render(createElement(CumulativeLine, { title: "Gasto", series: [{ label: "Novembro", points: [0] }] }));
    expect(c.querySelectorAll("polyline")).toHaveLength(1);
    expect(text(c)).toContain("R$ 0,00");
  });
});
