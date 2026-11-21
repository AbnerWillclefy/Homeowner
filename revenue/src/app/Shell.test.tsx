import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPassword } from "../auth/ForgotPassword";
import { SignIn } from "../auth/SignIn";
import { renderApp } from "../testing";
import { Shell } from "./Shell";
import { ROUTES } from "./screens";

const width = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));

const shell = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route element={<Shell />}>
        {ROUTES.map((r) => (r.path === "/" ? <Route key="/" index element={r.element} /> : <Route key={r.path} path={r.path} element={r.element} />))}
      </Route>
    </Routes>,
    options,
  );

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const EN = ["Overview", "Transactions", "Bills to pay", "Card bills", "Spending Categories", "Pantry", "Ask", "Goals", "Net worth", "Projection", "Sources", "Settings"];
const PT = ["Visão geral", "Lançamentos", "Contas a pagar", "Faturas", "Categorias de gasto", "Despensa", "Perguntar", "Objetivos", "Patrimônio", "Projeção", "Fontes", "Configurações"];

describe("shell navigation", () => {
  it("shows the Sidebar on a desktop width, with its 11 items plus Ask, and no Onboarding", () => {
    width(true);
    shell({ locale: "en" });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(EN);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(within(nav).queryByRole("link", { name: /^(Plan|More)$/ })).toBeNull();
  });

  it("puts Ask last in Main, current on /chat and carrying the screen it was opened from", () => {
    width(true);
    shell({ locale: "en", path: "/bills" });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link")).toHaveLength(11 + 1);
    expect(within(nav).getAllByRole("link")[6]!.textContent).toBe("Ask");
    expect(within(nav).getByRole("link", { name: "Ask" }).getAttribute("href")).toBe("/chat?from=bills");
  });

  it("marks Ask current on /chat and keeps its own from", () => {
    width(true);
    shell({ locale: "en", path: "/chat?from=goals" });
    const ask = within(screen.getByRole("navigation")).getByRole("link", { name: "Ask" });
    expect(ask.getAttribute("aria-current")).toBe("page");
    expect(ask.getAttribute("href")).toBe("/chat?from=goals");
  });

  it("leaves Ask out of the tabs and hides the BottomBar on the chat on a phone", () => {
    width(false);
    shell({ locale: "en", path: "/chat" });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ask" })).toBeTruthy();
  });

  it("shows four tabs on a phone width, in order, and the Sidebar has neither Plan nor More", () => {
    width(false);
    shell({ locale: "en" });
    const tabs = within(screen.getByRole("navigation", { name: "Main navigation" })).getAllByRole("link");
    expect(tabs).toHaveLength(4);
    expect(tabs.map((a) => a.textContent)).toEqual(["Home", "Transactions", "Plan", "More"]);
    expect(tabs[0]!.getAttribute("aria-current")).toBe("page");
    expect(tabs.slice(1).map((a) => a.getAttribute("aria-current"))).toEqual([null, null, null]);
  });

  it("names the tabs Início, Lançamentos, Planejar and Mais in pt-BR", () => {
    width(false);
    shell({ locale: "pt-BR" });
    expect(within(screen.getByRole("navigation")).getAllByRole("link").map((a) => a.textContent)).toEqual(["Início", "Lançamentos", "Planejar", "Mais"]);
  });

  it.each([
    ["/plan", "Plan"],
    ["/goals", "Plan"],
    ["/net-worth", "Plan"],
    ["/projection", "Plan"],
    ["/sources", "Plan"],
    ["/more", "More"],
    ["/bills", "More"],
    ["/card-bills", "More"],
    ["/categories", "More"],
    ["/categories/groceries", "More"],
    ["/pantry", "More"],
    ["/pantry/list", "More"],
    ["/settings", "More"],
    ["/transactions", "Transactions"],
    ["/", "Home"],
  ])("marks only the %s tab current on %s", (path, tab) => {
    width(false);
    shell({ locale: "en", path });
    const current = within(screen.getByRole("navigation")).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual([tab]);
  });

  it("opens the More screen from its tab, with no dialog", async () => {
    width(false);
    shell({ locale: "en" });
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("link", { name: "More" }));
    expect(screen.getByRole("heading", { level: 1, name: "More" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names every screen in pt-BR", () => {
    width(true);
    shell({ locale: "pt-BR" });
    expect(within(screen.getByRole("navigation")).getAllByRole("link").map((a) => a.textContent)).toEqual(PT);
  });

  it("marks the current screen, and opens a screen on click", async () => {
    width(true);
    shell({ locale: "en", path: "/bills" });
    expect(screen.getByRole("link", { name: "Bills to pay" }).getAttribute("aria-current")).toBe("page");
    await userEvent.click(screen.getByRole("link", { name: "Goals" }));
    expect(screen.getByRole("heading", { level: 1, name: "Goals" })).toBeTruthy();
  });
});

describe("accessibility", () => {
  const COMBOS = [
    ["dark", "pt-BR"],
    ["light", "pt-BR"],
    ["dark", "en"],
    ["light", "en"],
  ] as const;
  const check = async () => {
    // Axe in jsdom has no layout, so it cannot check contrast; tokens.test.ts in bedrock covers it.
    const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  };

  describe.each(COMBOS)("%s %s", (theme, locale) => {
    const options = { theme, locale } as const;
    it("sign-in", async () => {
      renderApp(<SignIn onForgot={() => {}} />, { ...options, signedIn: false });
      await check();
    });
    it("forgot password", async () => {
      renderApp(<ForgotPassword onBack={() => {}} />, { ...options, signedIn: false });
      await check();
    });
    it.each([true, false])("shell, desktop %s", async (desktop) => {
      width(desktop);
      shell(options);
      await check();
    });
  });
});
