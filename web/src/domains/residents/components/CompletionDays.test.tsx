// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../../shared/i18n";
import type { ResidentDay } from "../api/api";
import { CompletionDays } from "./CompletionDays";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const completion = (id: string, choreName: string, completedAt: string, withNames: string[] = []) => ({
  id,
  choreName,
  category: "kitchen",
  completedAt,
  with: withNames.map((name, index) => ({ id: "p" + index, name })),
});
const DAYS: ResidentDay[] = [
  { date: "2030-01-15", completions: [completion("c1", "Wash the dishes", "2030-01-15T15:00:00Z", ["Bruna"])] },
  { date: "2030-01-14", completions: [completion("c2", "Take out the trash", "2030-01-14T15:00:00Z")] },
];

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

const list = (days: ResidentDay[], heading: string, key?: string) =>
  createElement(CompletionDays, { key, days, today: "2030-01-15", timeZone: "America/Sao_Paulo", heading, empty: "Nothing yet." });
const render = (...lists: ReturnType<typeof list>[]) => act(() => root.render(createElement(I18nProvider, null, lists)));

describe("CompletionDays", () => {
  it("shows the days newest first under the heading, in the order given", () => {
    render(list(DAYS, "Done lately"));
    expect(container.querySelector("h3")?.textContent).toBe("Done lately");
    expect([...container.querySelectorAll("h4")].map((h) => h.textContent)).toEqual(["Today", "Yesterday"]);
  });

  it("names who a two-person Completion was done with", () => {
    render(list(DAYS, "Done lately"));
    const items = [...container.querySelectorAll("li")].map((li) => li.textContent);
    expect(items[0]).toContain("Kitchen · 12:00 PM, with Bruna");
    expect(items[1]).toContain("Kitchen · 12:00 PM");
    expect(items[1]).not.toContain("with");
  });

  it("shows the empty text and no day when there are no Completions", () => {
    render(list([], "Done lately"));
    expect(container.textContent).toContain("Nothing yet.");
    expect(container.querySelector("h4")).toBeNull();
  });

  it("labels each list by its own heading, so two lists on one page do not collide", () => {
    render(list(DAYS, "A", "a"), list(DAYS, "B", "b"));
    const ids = [...container.querySelectorAll("section")].map((s) => s.getAttribute("aria-labelledby"));
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(document.getElementById(id!)).not.toBeNull();
  });
});
