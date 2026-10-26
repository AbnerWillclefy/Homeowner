// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstLoadSettledContext } from "./FirstLoadSettledContext";
import { PageLoading, useReportFirstLoad } from "./PageLoading";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Section({ name, loading }: { name: string; loading: boolean }) {
  const showSkeleton = useReportFirstLoad(loading);
  return showSkeleton ? createElement("p", { "data-testid": name }, `${name} skeleton`) : null;
}

let container: HTMLElement;
let root: Root;

const mount = (children: ReactNode) => act(() => root.render(createElement(PageLoading, { message: "Loading", children })));
const status = () => container.querySelector('[role="status"]')!;
const skeleton = (name: string) => container.querySelector(`[data-testid="${name}"]`);

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("PageLoading", () => {
  it("keeps one empty status region mounted before 300ms and shows no skeleton", () => {
    mount(createElement(Section, { name: "a", loading: true }));
    act(() => vi.advanceTimersByTime(299));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(status().textContent).toBe("");
    expect(skeleton("a")).toBeNull();
  });

  it("gives the status its message and shows the skeleton after 300ms", () => {
    mount(createElement(Section, { name: "a", loading: true }));
    act(() => vi.advanceTimersByTime(300));
    expect(status().textContent).toBe("Loading");
    expect(skeleton("a")).not.toBeNull();
  });

  it("hides the skeleton of a section that is not loading while another section holds the page loading", () => {
    mount([createElement(Section, { key: "a", name: "a", loading: true }), createElement(Section, { key: "b", name: "b", loading: false })]);
    act(() => vi.advanceTimersByTime(300));
    expect(status().textContent).toBe("Loading");
    expect(skeleton("a")).not.toBeNull();
    expect(skeleton("b")).toBeNull();
  });

  it("empties the status once every section has loaded, without unmounting it", () => {
    mount(createElement(Section, { name: "a", loading: true }));
    act(() => vi.advanceTimersByTime(300));
    const region = status();
    mount(createElement(Section, { name: "a", loading: false }));
    expect(status()).toBe(region);
    expect(status().textContent).toBe("");
  });

  it("stops holding the page loading when a loading section unmounts", () => {
    mount([createElement(Section, { key: "a", name: "a", loading: true }), createElement(Section, { key: "b", name: "b", loading: true })]);
    act(() => vi.advanceTimersByTime(300));
    mount(createElement(Section, { key: "b", name: "b", loading: true }));
    expect(status().textContent).toBe("Loading");
    mount(null);
    expect(status().textContent).toBe("");
  });

  it("throws when a section is used outside a PageLoading", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => act(() => root.render(createElement(Section, { name: "a", loading: true })))).toThrow(/inside <PageLoading>/);
    error.mockRestore();
  });

  describe("first load settled", () => {
    const mountWith = (onSettled: () => void, children: ReactNode) =>
      act(() =>
        root.render(
          createElement(FirstLoadSettledContext, { value: onSettled }, createElement(PageLoading, { message: "Loading", children })),
        ),
      );
    const flush = () => act(() => vi.advanceTimersByTime(0));

    it("fires once after the only section reports true then false", () => {
      const onSettled = vi.fn();
      mountWith(onSettled, createElement(Section, { name: "a", loading: true }));
      flush();
      expect(onSettled).not.toHaveBeenCalled();
      mountWith(onSettled, createElement(Section, { name: "a", loading: false }));
      flush();
      expect(onSettled).toHaveBeenCalledTimes(1);
      mountWith(onSettled, createElement(Section, { name: "a", loading: true }));
      mountWith(onSettled, createElement(Section, { name: "a", loading: false }));
      flush();
      expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it("does not fire while a section hands over to another that is loading", () => {
      const onSettled = vi.fn();
      mountWith(onSettled, createElement(Section, { key: "gate", name: "gate", loading: true }));
      flush();
      mountWith(onSettled, createElement(Section, { key: "plan", name: "plan", loading: true }));
      flush();
      expect(onSettled).not.toHaveBeenCalled();
      mountWith(onSettled, createElement(Section, { key: "plan", name: "plan", loading: false }));
      flush();
      expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it("fires for a section that fails, which reports false like a loaded one", () => {
      const onSettled = vi.fn();
      mountWith(onSettled, createElement(Section, { name: "a", loading: true }));
      mountWith(onSettled, createElement(Section, { name: "a", loading: false }));
      flush();
      expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it("fires once for a page whose sections report false from the start", () => {
      const onSettled = vi.fn();
      mountWith(onSettled, createElement(Section, { name: "a", loading: false }));
      flush();
      expect(onSettled).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1000));
      expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it("never fires for a page with no section that reports, so the launch sync falls back to its timer", () => {
      const onSettled = vi.fn();
      mountWith(onSettled, createElement("p", null, "static"));
      flush();
      act(() => vi.advanceTimersByTime(1000));
      expect(onSettled).not.toHaveBeenCalled();
    });

    it("does nothing without the context", () => {
      mount(createElement(Section, { name: "a", loading: false }));
      expect(() => flush()).not.toThrow();
    });
  });
});
