// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n";
import { GoalsCard } from "./GoalsCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("ignores a second move while the first reorder is pending", async () => {
  const goals = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), targetCents: 100, targetMonth: null, savedCents: 0, monthCents: null, expectedMonth: null, late: false }));
  let finish!: (r: "saved") => void;
  const reorder = vi.fn(() => new Promise<"saved">((resolve) => (finish = resolve)));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const noop = vi.fn();
  act(() => root.render(createElement(I18nProvider, null, createElement(GoalsCard, { goals, save: noop, remove: noop, reorder }))));
  const click = (el: Element) => act(() => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  click([...container.querySelectorAll("button")].find((b) => b.textContent === "Reorder" || b.textContent === "Reordenar")!);
  const up = () => container.querySelectorAll("li")[2]!.querySelectorAll("button")[0]!;
  click(up());
  click(up());
  expect(reorder).toHaveBeenCalledTimes(1);
  await act(async () => finish("saved"));
  click(up());
  expect(reorder).toHaveBeenCalledTimes(2);
  act(() => root.unmount());
  container.remove();
});
