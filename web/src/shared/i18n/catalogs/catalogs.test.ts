import { describe, expect, it } from "vitest";
import type { Message } from "../translate";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

const en: Record<string, Message> = enUS;
const pt: Record<string, Message> = ptBR;

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
