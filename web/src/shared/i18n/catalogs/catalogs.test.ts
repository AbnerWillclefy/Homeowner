import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Message } from "../translate";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

const en: Record<string, Message> = enUS;
const pt: Record<string, Message> = ptBR;

// Keys built at runtime. Keep entries narrow: a broad prefix hides dead keys.
// An entry ending in "." is a prefix, any other entry is an exact key.
const runtimeKeys = [
  { key: "spending.", reason: "spendingKey(id) builds it from the category id" },
  { key: "effort.level.", reason: "effortLevelKey(level)" },
  { key: "chores.interval.", reason: "built from the preset ids, including custom" },
  { key: "voice.field.", reason: "built from the edited field name" },
  { key: "voice.action.accept", reason: "`voice.action.${action.kind}`" },
  { key: "voice.action.take", reason: "`voice.action.${action.kind}`" },
  { key: "voice.action.refuse", reason: "`voice.action.${action.kind}`" },
  { key: "voice.action.complete", reason: "`voice.action.${action.kind}`" },
  { key: "finances.view.", reason: "FinanceNav builds it from the view id" },
  { key: "finances.report.", reason: "Spending builds it from diff.key" },
  { key: "finances.summary.pace.more", reason: "paceSentence builds it from gap.key" },
  { key: "finances.summary.pace.less", reason: "paceSentence builds it from gap.key" },
  { key: "finances.summary.pace.same", reason: "paceSentence builds it from gap.key" },
  { key: "finances.summary.pace.avg.", reason: "paceSentence builds it from usual.key" },
  { key: "finances.limit.under", reason: "CategoryBar builds it from standing.key" },
  { key: "finances.limit.over", reason: "CategoryBar builds it from standing.key" },
  { key: "finances.limit.at", reason: "CategoryBar builds it from standing.key" },
  { key: "finances.bills.group.overdue", reason: "BillsSection builds it from the group id" },
  { key: "finances.bills.group.due", reason: "BillsSection builds it from the group id" },
  { key: "finances.bills.group.paid", reason: "BillsSection builds it from the group id" },
  { key: "catalog.collection.trash", reason: "Questionnaire builds it from stream" },
  { key: "catalog.collection.recycling", reason: "Questionnaire builds it from stream" },
];

const allowed = (key: string) => runtimeKeys.some((r) => key.startsWith(r.key));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "catalogs" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

function forms(message: Message): [string, string][] {
  return typeof message === "string"
    ? [["", message]]
    : (Object.entries(message) as [string, string][]);
}

describe("message catalogs", () => {
  it("have the same keys in both directions", () => {
    const missingInPt = Object.keys(en).filter((k) => !(k in pt));
    const extraInPt = Object.keys(pt).filter((k) => !(k in en));
    expect(missingInPt, `keys missing in pt-BR: ${missingInPt}`).toEqual([]);
    expect(extraInPt, `keys only in pt-BR: ${extraInPt}`).toEqual([]);
  });

  it("have no key that nothing reads", () => {
    // shortcut: a key quoted in a comment counts as used, upgrade if that hides dead keys.
    const source = sourceFiles(new URL("../../..", import.meta.url).pathname)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const unused = Object.keys(en).filter(
      (k) => !allowed(k) && !['"', "'", "`"].some((q) => source.includes(q + k + q)),
    );
    expect(unused, `catalog keys nothing reads: ${unused}`).toEqual([]);
  });

  it("allow-list only names keys that exist", () => {
    const stale = runtimeKeys.filter((r) => !Object.keys(en).some((k) => k.startsWith(r.key)));
    expect(stale.map((r) => r.key)).toEqual([]);
  });

  it("no longer number Residents (\"Resident N\"): names and avatars replaced it", () => {
    expect("dayplan.others.resident" in en).toBe(false);
    expect("dayplan.others.resident" in pt).toBe(false);
    for (const catalog of [en, pt]) {
      for (const message of Object.values(catalog)) {
        for (const [, text] of forms(message)) expect(text).not.toMatch(/\b(Resident|Morador) \{number\}/);
      }
    }
  });

  it("have the same shape (string or plural) for every key", () => {
    for (const key of Object.keys(en)) {
      expect(typeof pt[key], `shape differs for ${key}`).toBe(typeof en[key]);
    }
  });

  it("have no empty or whitespace-only values", () => {
    for (const [name, catalog] of [["en-US", en], ["pt-BR", pt]] as const) {
      for (const [key, message] of Object.entries(catalog)) {
        for (const [form, text] of forms(message)) {
          expect(text.trim(), `${name} ${key} ${form} is empty`).not.toBe("");
        }
      }
    }
  });

  it("have the same placeholders for every key and plural form", () => {
    for (const key of Object.keys(en)) {
      const enForms = Object.fromEntries(forms(en[key]!));
      const ptForms = Object.fromEntries(forms(pt[key]!));
      for (const form of Object.keys(ptForms)) {
        const source = enForms[form] ?? enForms["other"] ?? enForms[""]!;
        expect(placeholders(ptForms[form]!), `placeholders differ for ${key} ${form}`).toEqual(
          placeholders(source),
        );
      }
    }
  });

  it("give every plural both one and other", () => {
    for (const [name, catalog] of [["en-US", en], ["pt-BR", pt]] as const) {
      for (const [key, message] of Object.entries(catalog)) {
        if (typeof message === "string") continue;
        expect(message.one, `${name} ${key} lacks one`).toBeTruthy();
        expect(message.other, `${name} ${key} lacks other`).toBeTruthy();
      }
    }
  });
});
