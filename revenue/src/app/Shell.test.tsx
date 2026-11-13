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

const EN = ["Overview", "Transactions", "Bills to pay", "Card bills", "Spending Categories", "Goals", "Net worth", "Projection", "Sources", "Settings"];
const PT = ["Visão geral", "Lançamentos", "Contas a pagar", "Faturas", "Categorias de gasto", "Objetivos", "Patrimônio", "Projeção", "Fontes", "Configurações"];

describe("shell navigation", () => {
  it("shows the Sidebar on a desktop width, with the 10 items and no Onboarding", () => {
    width(true);
    shell({ locale: "en" });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(EN);
    expect(within(nav).queryByText("Getting started")).toBeNull();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("shows the BottomBar on a phone width, with the other screens under More", async () => {
    width(false);
    shell({ locale: "en" });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Overview", "Transactions", "Bills to pay", "Goals", "More"]);
    await userEvent.click(within(nav).getByRole("link", { name: "More" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getAllByRole("link").map((a) => a.textContent)).toEqual(["Card bills", "Spending Categories", "Net worth", "Projection", "Sources", "Settings"]);
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

  it("reaches Onboarding by its route", () => {
    width(true);
    shell({ locale: "en", path: "/onboarding" });
    expect(screen.getByRole("heading", { level: 1, name: "Getting started" })).toBeTruthy();
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
