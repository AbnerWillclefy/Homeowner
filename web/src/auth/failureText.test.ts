import { describe, expect, it } from "vitest";
import { enUS } from "../shared/i18n/catalogs/en-US";
import { ptBR } from "../shared/i18n/catalogs/pt-BR";
import { createTranslate } from "../shared/i18n/translate";
import type { CognitoFailure } from "./cognito";
import { formErrorId } from "../shared/ui/formErrorId";
import { failureField, failureKey, failureMessage, fieldError } from "./failureText";
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
      "That password is not strong enough. Choose a different password. At least 10 characters, with an upper case letter, a lower case letter and a number.",
    );
    expect(english("invalid-password")).not.toMatch(/symbol/i);
    expect(portuguese("invalid-password")).toBe(
      "Essa senha não é forte o bastante. Escolha outra senha. Pelo menos 10 caracteres, com uma letra maiúscula, uma letra minúscula e um número.",
    );
  });

  it("follows a stricter policy", () => {
    expect(english("invalid-password", strict)).toMatch(/12 characters.*a number and a symbol\.$/);
    expect(portuguese("invalid-password", strict)).toMatch(/12 caracteres.*um número e um símbolo\.$/);
  });

  // Every message says what the User can do next, in their own words.
  const nextStep: Record<CognitoFailure["kind"], [RegExp, RegExp]> = {
    "already-registered": [/sign in instead/i, /entre com ele/i],
    "invalid-password": [/choose a different password/i, /escolha outra senha/i],
    "invalid-input": [/try again/i, /tente novamente/i],
    "wrong-code": [/try again/i, /tente novamente/i],
    "expired-code": [/request a new code/i, /solicite um novo código/i],
    "not-confirmed": [/confirm your email/i, /confirme seu e-mail/i],
    "not-authorized": [/try again/i, /tente novamente/i],
    "rate-limited": [/wait.*try again/i, /espere.*tente novamente/i],
    network: [/try again/i, /tente novamente/i],
    error: [/try again/i, /tente novamente/i],
  };

  it.each(kinds)("says what to do next for %s", (kind) => {
    const [en, pt] = nextStep[kind];
    expect(english(kind)).toMatch(en);
    expect(portuguese(kind)).toMatch(pt);
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

describe("failureField", () => {
  it("points a refused password at the password field", () => {
    expect(failureField({ kind: "invalid-password" })).toBe("password");
  });

  it("points a wrong or expired code at the code field", () => {
    expect(failureField({ kind: "wrong-code" })).toBe("code");
    expect(failureField({ kind: "expired-code" })).toBe("code");
  });

  it("points an unusable email at the email field", () => {
    expect(failureField({ kind: "already-registered" })).toBe("email");
    expect(failureField({ kind: "invalid-input" })).toBe("email");
  });

  it("leaves the rest to the form", () => {
    for (const kind of ["not-confirmed", "not-authorized", "rate-limited", "network", "error"] as const) {
      expect(failureField({ kind })).toBeNull();
    }
  });
});

describe("fieldError", () => {
  const none = { "aria-invalid": undefined, "aria-describedby": undefined };

  it("marks the field a failure is about and points it at the form's error", () => {
    expect(fieldError({ kind: "wrong-code" }, "code", "confirm")).toEqual({
      "aria-invalid": true,
      "aria-describedby": formErrorId("confirm"),
    });
  });

  it("keeps the field's own hints ahead of the error", () => {
    expect(fieldError({ kind: "invalid-password" }, "password", "signup", "why rules")).toEqual({
      "aria-invalid": true,
      "aria-describedby": "why rules signup-error",
    });
  });

  it("leaves a field alone when the failure is about another field or the whole form", () => {
    expect(fieldError({ kind: "wrong-code" }, "email", "signin", "hint")).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": "hint",
    });
    expect(fieldError({ kind: "network" }, "email", "signin")).toEqual(none);
    expect(fieldError(null, "email", "signin")).toEqual(none);
  });
});

describe("formErrorId", () => {
  it("derives the error's id from the form's name", () => {
    expect(formErrorId("signin")).toBe("signin-error");
  });
});
