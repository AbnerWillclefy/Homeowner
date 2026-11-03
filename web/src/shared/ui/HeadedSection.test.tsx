// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { HeadedSection } from "./HeadedSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("names each section by its own h3, so two groups on one page do not collide", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render([
      createElement(HeadedSection, { key: "a", title: "A", children: "x" }),
      createElement(HeadedSection, { key: "b", title: "B", children: "y" }),
    ]),
  );
  const ids = [...container.querySelectorAll("section")].map((s) => s.getAttribute("aria-labelledby")!);
  expect(new Set(ids).size).toBe(2);
  expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(["A", "B"]);
  act(() => root.unmount());
  container.remove();
});
