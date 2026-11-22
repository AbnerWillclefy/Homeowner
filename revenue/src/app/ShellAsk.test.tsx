import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "../domains/bills/api";
import * as sourcesApi from "../domains/sources/api";
import { screenKeyOf } from "../domains/chat/logic/screenKeys";
import { renderApp } from "../testing";
import { PANTRY_LIST, ROUTES } from "./screens";
import { Shell } from "./Shell";

vi.mock("../domains/bills/api", async (original) => ({ ...(await original<typeof import("../domains/bills/api")>()), getBills: vi.fn() }));
vi.mock("../domains/sources/api", async (original) => ({ ...(await original<typeof import("../domains/sources/api")>()), getSources: vi.fn() }));

// The real screens need their APIs; the button belongs to the frame, so a plain page stands in for each.
const shell = (path: string) =>
  renderApp(
    <Routes>
      <Route element={<Shell />}>
        {ROUTES.map((r) => (r.path === "/" ? <Route key="/" index element={<p>screen</p>} /> : <Route key={r.path} path={r.path} element={<p>screen</p>} />))}
      </Route>
    </Routes>,
    { locale: "en", path },
  );
const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
// The Sidebar has its own "Ask" link; the button is the one outside the navigation.
const button = () => screen.queryAllByRole("link", { name: "Ask" }).find((a) => !a.closest("nav"));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(billsApi.getBills).mockResolvedValue([]);
  vi.mocked(sourcesApi.getSources).mockResolvedValue({ sources: [], items: [], importing: false, lastSyncedAt: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("the Ask button", () => {
  it.each([false, true])("is on every screen but the chat, and the phone's Shopping list, with its screen key (desktop: %s)", (desktop) => {
    width(desktop);
    expect(ROUTES.length).toBeGreaterThan(10);
    let checked = 0;
    for (const r of ROUTES) {
      const path = r.path.replace(":category", "groceries");
      const { unmount } = shell(path);
      const ask = button();
      // The phone's Shopping list dock sits where the button would.
      if (path === "/chat" || (!desktop && path === PANTRY_LIST.path)) expect(ask, path).toBeUndefined();
      else {
        expect(ask?.getAttribute("href"), path).toBe(`/chat?from=${screenKeyOf(path)}`);
        checked++;
      }
      unmount();
    }
    expect(checked).toBe(ROUTES.length - (desktop ? 1 : 2));
  });

  it("is fixed below the sheets and toasts, and the content leaves room for it", () => {
    width(false);
    shell("/transactions");
    expect(button()!.className).toContain("fixed");
    expect(button()!.className).toContain("z-(--z-sticky)");
    expect(screen.getByRole("main").className).toContain("pb-24");
  });

  it("leaves the chat's own padding alone", () => {
    width(false);
    shell("/chat");
    expect(screen.getByRole("main").className).not.toContain("pb-24");
  });
});
