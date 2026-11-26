// @vitest-environment jsdom
// Axe in jsdom has no layout or computed colour, so `color-contrast` is off, as in Bedrock's showcase test; the
// contrast of the hero is checked by hand in DevTools (see the pull request's checklist).
import axe from "axe-core";
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellContext } from "../../../app/components/ShellContext";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type I18n } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { CheckIn } from "../../checkin/api/api";
import { dayPlan, task } from "../testing/fixtures";
import { TodayHero } from "./TodayHero";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

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

type Shell = NonNullable<ComponentProps<typeof ShellContext.Provider>["value"]>;
const UNSET: CheckIn = { date: "2026-10-11", checkedIn: false, level: null, restrictions: [] };
const LOW: CheckIn = { date: "2026-10-11", checkedIn: true, level: "low", restrictions: [] };
const done = (id: string) => ({ id, choreName: id, completedAt: "2026-10-11T10:00:00Z" }) as never;

function show(locale: Locale, state: Shell["checkIn"]["state"], plan = dayPlan()) {
  const openCheckIn = vi.fn();
  const save = vi.fn();
  const reload = vi.fn();
  const shell = { checkIn: { state, save, reload }, openCheckIn, heroRef: { current: null } } as unknown as Shell;
  const i18n: I18n = { locale, setLocale: () => {}, t: (key, params) => translate(locale, key, params) };
  act(() =>
    root.render(
      createElement(I18nContext.Provider, { value: i18n }, createElement(ShellContext.Provider, { value: shell }, createElement(TodayHero, { plan }))),
    ),
  );
  return { openCheckIn, save, reload };
}
const byName = (role: string, name: string) =>
  [...container.querySelectorAll(role)].find((el) => el.getAttribute("aria-label") === name || el.textContent?.trim() === name) as HTMLElement | undefined;

async function noViolations() {
  const { violations } = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

describe.each(["pt-BR", "en-US"] as const)("TodayHero in %s", (locale) => {
  const pt = locale === "pt-BR";

  it("before the Check-in asks the four levels and, on a pick, opens the dialog with it without saving", async () => {
    const { openCheckIn, save } = show(locale, { kind: "ready", checkIn: UNSET });
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.value)).toEqual(["drained", "low", "normal", "energized"]);
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute("aria-label")).toBe(pt ? "Como está a sua energia hoje?" : "How is your Energy today?");
    await noViolations();

    act(() => radios[2]!.click());
    expect(openCheckIn).toHaveBeenCalledWith(container.querySelector("section"), "normal");
    expect(save).not.toHaveBeenCalled();
  });

  it("opens the dialog with no level from the Restrictions link", () => {
    const { openCheckIn } = show(locale, { kind: "ready", checkIn: UNSET });
    act(() => byName("button", pt ? "Alguma restrição só hoje?" : "Any Restriction just for today?")!.click());
    expect(openCheckIn).toHaveBeenCalledWith(container.querySelector("section"), undefined);
  });

  it("after the Check-in shows the Energy chip, the count and the bar, and the chip reopens the dialog", async () => {
    const plan = { ...dayPlan({ mine: [task("a"), task("b")] }), doneToday: [done("d")] };
    const { openCheckIn } = show(locale, { kind: "ready", checkIn: LOW }, plan);
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe(pt ? "1 de 3 feitas" : "1 of 3 done");
    expect(container.textContent).toContain(pt ? "1 de 3 feitas" : "1 of 3 done");
    const chip = byName("button", pt ? "Energia: baixa. Mudar" : "Energy: low. Change")!;
    expect(chip.textContent).toBe(pt ? "Baixa" : "Low");
    await noViolations();

    act(() => chip.click());
    expect(openCheckIn).toHaveBeenCalledWith(chip);
  });

  it("agrees the count with the total: one Task reads \"feita\" in pt-BR", () => {
    show(locale, { kind: "ready", checkIn: LOW }, { ...dayPlan({ mine: [] }), doneToday: [done("d")] });
    expect(container.textContent).toContain(pt ? "1 de 1 feita" : "1 of 1 done");
    expect(container.textContent).not.toContain("1 de 1 feitas");
  });

  it("shows no figure and no bar when there is nothing to count, never 0 of 0", () => {
    show(locale, { kind: "ready", checkIn: LOW }, dayPlan({ planned: false }));
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).not.toMatch(/0 (de|of) 0/);
    expect(byName("button", pt ? "Energia: baixa. Mudar" : "Energy: low. Change")).toBeDefined();
  });

  it("says when the Check-in could not be read and retries", async () => {
    const { reload } = show(locale, { kind: "failed", reason: "error" });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(pt ? "Energia indisponível." : "Energy unavailable.");
    await noViolations();
    act(() => byName("button", pt ? "Tentar de novo" : "Try again")!.click());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("draws nothing while the Check-in loads", () => {
    show(locale, { kind: "loading" });
    expect(container.innerHTML).toBe("");
  });
});
