// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../../shared/i18n";
import { AllocationTimePicker } from "./AllocationTimePicker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks what Radix Select calls when it opens.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Opens the picker the way a keyboard does and returns the options it lists. */
function options(value: string): string[] {
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(AllocationTimePicker, { value, onChange: () => {}, label: "Allocation time" }),
      ),
    ),
  );
  const trigger = container.querySelector<HTMLElement>("[role=combobox]")!;
  act(() => {
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  return [...document.querySelectorAll("[role=option]")].map((o) => o.textContent ?? "");
}

describe("AllocationTimePicker", () => {
  it("offers all 96 slots, from 00:00 to 23:45", () => {
    const shown = options("07:00");
    expect(shown).toHaveLength(96);
    expect(shown[0]).toMatch(/^(12:00 AM|0:00|00:00)/);
    expect(shown[95]).toMatch(/^(11:45 PM|23:45)/);
    expect(new Set(shown).size).toBe(96);
  });

  it("shows a stored time outside the list as it is, instead of crashing", () => {
    const shown = options("06:50");
    expect(shown).toHaveLength(97);
    expect(shown[0]).toMatch(/6:50/);
  });
});
