// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthResult } from "../api/healthApi";
import { I18nProvider } from "../../shared/i18n";
import { HealthBanner } from "./HealthBanner";
import { HealthProvider, useHealthStatus } from "./HealthProvider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getHealth = vi.hoisted(() => vi.fn<(signal?: AbortSignal) => Promise<HealthResult>>());
vi.mock("../api/healthApi", () => ({ getHealth }));

let container: HTMLElement;
let root: Root;

const banners = () => container.querySelectorAll('[role="status"]');
const flush = () => act(async () => {});
/** One banner per key, to stand in for the banners of the different layouts. */
const page = (...consumers: string[]) =>
  createElement(
    I18nProvider,
    null,
    createElement(
      HealthProvider,
      null,
      ...consumers.map((key) => createElement("section", { key }, createElement(HealthBanner))),
    ),
  );

beforeEach(() => {
  getHealth.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("HealthProvider", () => {
  it("asks the API once, however many banners mount and unmount under it", async () => {
    getHealth.mockResolvedValue({ kind: "ok" });
    act(() => root.render(page("a", "b")));
    await flush();
    act(() => root.render(page("b")));
    act(() => root.render(page("c")));
    await flush();
    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it("shows the banner in every consumer when unreachable, and Retry re-checks and clears them all", async () => {
    getHealth.mockResolvedValueOnce({ kind: "unreachable" }).mockResolvedValueOnce({ kind: "ok" });
    act(() => root.render(page("a", "b")));
    await flush();
    expect(banners()).toHaveLength(2);
    expect(getHealth).toHaveBeenCalledTimes(1);

    act(() => container.querySelector("button")!.click());
    await flush();
    expect(getHealth).toHaveBeenCalledTimes(2);
    expect(banners()).toHaveLength(0);
  });

  it("throws when useHealthStatus is used outside the provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Probe = () => {
      useHealthStatus();
      return null;
    };
    expect(() => act(() => root.render(createElement(Probe)))).toThrow(/HealthProvider/);
    error.mockRestore();
  });
});
