import { describe, expect, it } from "vitest";
import type { Message } from "../translate";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

// CONTEXT.md avoids "Profile" for a User; the screen is called Me. No text a User can see or hear may say it.

function values(message: Message): string[] {
  return typeof message === "string" ? [message] : Object.values(message);
}

function offending(catalog: Record<string, Message>, word: RegExp): string[] {
  return Object.entries(catalog)
    .filter(([, message]) => values(message).some((text) => word.test(text)))
    .map(([key]) => key);
}

describe("the word Profile", () => {
  it("is in no en-US value", () => {
    expect(offending(enUS, /\bprofile\b/i)).toEqual([]);
  });

  it("is in no pt-BR value", () => {
    expect(offending(ptBR, /\bperfil\b/i)).toEqual([]);
  });
});
