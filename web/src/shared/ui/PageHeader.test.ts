// @vitest-environment jsdom
import { act, createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";
import { PageLoading, useReportFetching } from "./PageLoading";
import { mountWithI18n } from "./testing";

const { render, container } = mountWithI18n();
const slot = () => container().querySelector('[data-slot="fetching"]');

function Fetching({ on }: { on: boolean }) {
  useReportFetching(on);
  return null;
}

const page = (on: boolean) =>
  createElement(PageLoading, {
    message: "Loading",
    children: [createElement(PageHeader, { key: "h", title: "Today" }), createElement(Fetching, { key: "f", on })],
  });

describe("PageHeader", () => {
  it("has no fetching slot outside a PageLoading", () => {
    render(createElement(PageHeader, { title: "Sign in" }));
    expect(slot()).toBeNull();
    expect(container().querySelector("h2")?.textContent).toBe("Sign in");
  });

  it("reserves an empty slot inside a PageLoading while idle", () => {
    render(page(false));
    expect(slot()).not.toBeNull();
    expect(slot()!.className).toContain("w-4");
    expect(slot()!.querySelector("svg")).toBeNull();
  });

  it("fills the same slot with the spinner after 300ms of fetching, and empties it after", () => {
    render(page(true));
    act(() => vi.advanceTimersByTime(299));
    expect(slot()!.querySelector("svg")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(slot()!.querySelector('[aria-label="Refreshing"]')).not.toBeNull();
    render(page(false));
    expect(slot()!.querySelector("svg")).toBeNull();
    expect(container().querySelectorAll('[data-slot="fetching"]')).toHaveLength(1);
  });

  it("shows one spinner however many sections fetch", () => {
    render(
      createElement(PageLoading, {
        message: "Loading",
        children: [
          createElement(PageHeader, { key: "h", title: "Today" }),
          createElement(Fetching, { key: "a", on: true }),
          createElement(Fetching, { key: "b", on: true }),
        ],
      }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(container().querySelectorAll("svg")).toHaveLength(1);
  });
});
