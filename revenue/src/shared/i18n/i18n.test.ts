/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { en, ptBR } from "./catalogs";
import { LOCALE_STORAGE_KEY, readStoredLocale, resolveLocale, translate, writeStoredLocale } from "./i18n";

// Keys built at runtime. Keep entries narrow: a broad prefix hides dead keys.
// An entry ending in "." is a prefix, any other entry is an exact key.
const runtimeKeys = [
  { key: "prefs.theme.system", reason: "`prefs.theme.${value}` in shared/Preferences.tsx" },
  { key: "prefs.theme.light", reason: "`prefs.theme.${value}` in shared/Preferences.tsx" },
  { key: "prefs.theme.dark", reason: "`prefs.theme.${value}` in shared/Preferences.tsx" },
  { key: "signIn.error.not-authorized", reason: "`signIn.error.${message}` in auth/SignIn.tsx" },
  { key: "signIn.error.not-confirmed", reason: "`signIn.error.${message}` in auth/SignIn.tsx" },
  { key: "signIn.error.rate-limited", reason: "`signIn.error.${message}` in auth/SignIn.tsx" },
  { key: "signIn.error.network", reason: "`signIn.error.${message}` in auth/SignIn.tsx" },
  { key: "forgot.rule.", reason: "built from the password policy rule ids in auth/ForgotPassword.tsx" },
  { key: "forgot.error.", reason: "`forgot.error.${kind}` in ForgotPassword errorKey" },
  { key: "tx.type.", reason: "`tx.type.${type}` in Toolbar, TransactionRows and EditSheet" },
  { key: "tx.count.one", reason: "`${key}.one` in TransactionsPage plural" },
  { key: "tx.count.other", reason: "`${key}.other` in TransactionsPage plural" },
  { key: "tx.sources.one", reason: "`${key}.one` in TransactionsPage plural" },
  { key: "tx.sources.other", reason: "`${key}.other` in TransactionsPage plural" },
  { key: "bills.filter.all", reason: "built from FILTERS in bills/BillsPage.tsx" },
  { key: "bills.filter.pending", reason: "built from FILTERS in bills/BillsPage.tsx" },
  { key: "bills.filter.paid", reason: "built from FILTERS in bills/BillsPage.tsx" },
  { key: "cardBills.split.purchases", reason: "built in card-bills/components/CardBillCard.tsx" },
  { key: "cardBills.split.installments", reason: "built in card-bills/components/CardBillCard.tsx" },
  { key: "cardBills.split.subscriptions", reason: "built in card-bills/components/CardBillCard.tsx" },
  { key: "cardBills.days.closeDay", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "cardBills.days.closeDay.required", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "cardBills.days.closeDay.invalid", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "cardBills.days.dueDay", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "cardBills.days.dueDay.required", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "cardBills.days.dueDay.invalid", reason: "built in card-bills/components/BillDaysCard.tsx" },
  { key: "categories.limit.under", reason: "built in categories/components/LimitBar.tsx" },
  { key: "categories.limit.at", reason: "built in categories/components/LimitBar.tsx" },
  { key: "categories.limit.over", reason: "built in categories/components/LimitBar.tsx" },
  { key: "categories.caption.under", reason: "built in categories/components/CategoryRows.tsx" },
  { key: "categories.caption.at", reason: "built in categories/components/CategoryRows.tsx" },
  { key: "categories.caption.over", reason: "built in categories/components/CategoryRows.tsx" },
  { key: "spending.", reason: "spendingKey(id) builds it from the category id" },
  { key: "netWorth.note.", reason: "built in net-worth/NetWorthPage.tsx" },
  { key: "netWorth.range.30d", reason: "built in net-worth/NetWorthPage.tsx" },
  { key: "netWorth.range.90d", reason: "built in net-worth/NetWorthPage.tsx" },
  { key: "netWorth.range.1y", reason: "built in net-worth/NetWorthPage.tsx" },
  { key: "overview.tab.", reason: "`overview.tab.${v}` in overview/OverviewPage.tsx" },
  { key: "settings.income.empty", reason: "readIncome problems in settings/components/PlanningCard.tsx" },
  { key: "settings.income.zero", reason: "readIncome problems in settings/components/PlanningCard.tsx" },
  { key: "settings.income.junk", reason: "readIncome problems in settings/components/PlanningCard.tsx" },
];

const matches = (r: { key: string }, key: string) => (r.key.endsWith(".") ? key.startsWith(r.key) : key === r.key);
const allowed = (key: string) => runtimeKeys.some((r) => matches(r, key));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && e.name !== "catalogs.ts" ? [path] : [];
  });
}

describe("i18n", () => {
  it("has the same keys in both languages, none empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    for (const text of [...Object.values(en), ...Object.values(ptBR)]) expect(text).not.toBe("");
  });

  it("has no key that nothing reads", () => {
    // shortcut: a key quoted in a comment counts as used, upgrade if that hides dead keys.
    const files = sourceFiles(resolve(import.meta.dirname, "../.."));
    expect(files.length).toBeGreaterThan(0);
    const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
    const unused = Object.keys(en).filter((k) => !allowed(k) && !['"', "'", "`"].some((q) => source.includes(q + k + q)));
    expect(unused, `catalog keys nothing reads: ${unused}`).toEqual([]);
  });

  it("allow-list only names keys that exist", () => {
    const stale = runtimeKeys.filter((r) => !Object.keys(en).some((k) => matches(r, k)));
    expect(stale.map((r) => r.key)).toEqual([]);
  });

  it("defaults to pt-BR, and follows a stored choice before the browser", () => {
    expect(resolveLocale(null, [])).toBe("pt-BR");
    expect(resolveLocale(null, ["fr-FR"])).toBe("pt-BR");
    expect(resolveLocale(null, ["en-GB"])).toBe("en");
    expect(resolveLocale("pt-BR", ["en-US"])).toBe("pt-BR");
    expect(resolveLocale("en", ["pt-BR"])).toBe("en");
    expect(resolveLocale("xx", ["pt-BR"])).toBe("pt-BR");
  });

  it("fills {params}", () => {
    expect(translate("en", "forgot.rule.length", { count: 10 })).toBe("at least 10 characters");
    expect(translate("pt-BR", "nav.bills")).toBe("Contas a pagar");
  });

  it("stores the choice under revenue.locale", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    writeStoredLocale("en", storage);
    expect(LOCALE_STORAGE_KEY).toBe("revenue.locale");
    expect(readStoredLocale(storage)).toBe("en");
  });
});
