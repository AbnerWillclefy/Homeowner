// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { TodayReads } from "../logic/todayLoaded";
import { useTodayLoaded } from "./useTodayLoaded";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settled: TodayReads = { checkIn: { kind: "ready" }, dayPlan: { kind: "ready" }, streakLoading: false };
const loading: TodayReads = { ...settled, dayPlan: { kind: "loading" } };

describe("useTodayLoaded", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  function mount() {
    const seen: boolean[] = [];
    const Probe = ({ reads }: { reads: TodayReads }) => {
      seen.push(useTodayLoaded(reads));
      return null;
    };
    const root = createRoot(document.createElement("div"));
    cleanups.push(() => act(() => root.unmount()));
    const render = (reads: TodayReads) => act(() => root.render(createElement(Probe, { reads })));
    return { seen, render };
  }

  it("is false until every read has answered", () => {
    const { seen, render } = mount();
    render(loading);
    expect(seen.at(-1)).toBe(false);
    render(settled);
    expect(seen.at(-1)).toBe(true);
  });

  it("stays true after a Retry flips a read back to loading", () => {
    const { seen, render } = mount();
    render(settled);
    render(loading);
    expect(seen.at(-1)).toBe(true);
  });

  it("never reports false in the render that first settles", () => {
    const { seen, render } = mount();
    render(loading);
    seen.length = 0;
    render(settled);
    expect(seen).not.toContain(false);
  });
});
