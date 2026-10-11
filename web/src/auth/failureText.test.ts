import { describe, expect, it } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { ptBR } from "../i18n/catalogs/pt-BR";
import { createTranslate } from "../i18n/translate";
import type { CognitoFailure } from "./cognito";
import { failureKey, failureMessage } from "./failureText";
import { parsePolicy } from "./passwordPolicy";

const kinds: CognitoFailure["kind"][] = [
  "already-registered",
  "invalid-password",
  "invalid-input",
  "wrong-code",
  "expired-code",
  "not-confirmed",
  "not-authorized",
  "rate-limited",
  "network",
  "error",
];

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR });
const policy = parsePolicy(
  JSON.stringify({
    minimum_length: 10,
    require_lowercase: true,
    require_uppercase: true,
    require_numbers: true,
    require_symbols: false,
  }),
);
const strict = parsePolicy(
  JSON.stringify({
    minimum_length: 12,
    require_lowercase: true,
    require_uppercase: true,
    require_numbers: true,
    require_symbols: true,
  }),
);

const english = (kind: CognitoFailure["kind"], p = policy) =>
  failureMessage((key, params) => translate("en-US", key, params), { kind }, p);
const portuguese = (kind: CognitoFailure["kind"], p = policy) =>
  failureMessage((key, params) => translate("pt-BR", key, params), { kind }, p);

describe("failureKey", () => {
  it.each(kinds)("names a catalog key for %s", (kind) => {
    const key = failureKey({ kind });
    expect(key).toMatch(/^auth\.failure\./);
    expect(enUS[key]).toBeTruthy();
    expect(ptBR[key]).toBeTruthy();
  });

  it("gives each kind its own key", () => {
    expect(new Set(kinds.map((kind) => failureKey({ kind }))).size).toBe(kinds.length);
  });
});

describe("failureMessage", () => {
  it.each(kinds)("has words in both languages for %s", (kind) => {
    expect(english(kind).length).toBeGreaterThan(10);
    expect(portuguese(kind).length).toBeGreaterThan(10);
    expect(english(kind)).not.toMatch(/\{\w+\}/);
    expect(portuguese(kind)).not.toMatch(/\{\w+\}/);
  });

  it("does not say which of email or password was wrong", () => {
    expect(english("not-authorized")).toMatch(/email or password/i);
    expect(portuguese("not-authorized")).toMatch(/e-mail ou a senha/i);
  });

  it("states the policy's password rules when a password is refused", () => {
    expect(english("invalid-password")).toBe(
      "That password is not strong enough. At least 10 characters, with an upper case letter, a lower case letter and a number.",
    );
    expect(english("invalid-password")).not.toMatch(/symbol/i);
    expect(portuguese("invalid-password")).toBe(
      "Essa senha não é forte o bastante. Pelo menos 10 caracteres, com uma letra maiúscula, uma letra minúscula e um número.",
    );
  });

  it("follows a stricter policy", () => {
    expect(english("invalid-password", strict)).toMatch(/12 characters.*a number and a symbol\.$/);
    expect(portuguese("invalid-password", strict)).toMatch(/12 caracteres.*um número e um símbolo\.$/);
  });

  it("blames the connection only for a network failure", () => {
    expect(english("network")).toMatch(/connection/i);
    expect(english("error")).not.toMatch(/connection/i);
    expect(portuguese("network")).toMatch(/conexão/i);
    expect(portuguese("error")).not.toMatch(/conexão/i);
  });

  it("avoids the words the glossary rejects for a User", () => {
    for (const kind of kinds) {
      expect(english(kind)).not.toMatch(/account|profile/i);
      expect(portuguese(kind)).not.toMatch(/\bcontas?\b|\bperfil\b|\bperfis\b/i);
    }
  });

  it("keeps the confirm-screen word for the code", () => {
    expect(portuguese("already-registered")).toMatch(/código/);
    expect(portuguese("wrong-code")).toMatch(/código/);
    expect(portuguese("expired-code")).toMatch(/código/);
  });
});
