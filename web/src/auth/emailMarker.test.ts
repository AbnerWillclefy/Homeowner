import { describe, expect, it } from "vitest";
import { enUS } from "../shared/i18n/catalogs/en-US";
import { ptBR } from "../shared/i18n/catalogs/pt-BR";
import { createTranslate } from "../shared/i18n/translate";
import { EMAIL_MARKER, splitAtEmail } from "./emailMarker";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR });

describe("splitAtEmail", () => {
  it("splits a sentence around the marker so the email can be set in bold", () => {
    expect(splitAtEmail(`Signed in as ${EMAIL_MARKER}.`)).toEqual(["Signed in as ", "."]);
  });

  it("works for the sentences in the catalogs, in both languages", () => {
    const en = translate("en-US", "signedIn.as", { email: EMAIL_MARKER });
    expect(splitAtEmail(en)).toEqual(["Signed in as ", "."]);
    const pt = translate("pt-BR", "confirm.intro", { email: EMAIL_MARKER });
    expect(splitAtEmail(pt)[0]).toBe("Enviamos um código para ");
    expect(splitAtEmail(pt)[1]).toBe(".");
  });

  it("keeps all the text when the marker is missing", () => {
    expect(splitAtEmail("No email here.")).toEqual(["No email here.", ""]);
  });

  it("is exactly one character", () => {
    expect(EMAIL_MARKER.length).toBe(1);
  });

  it("splits text around the marker", () => {
    expect(splitAtEmail(`a${EMAIL_MARKER}b`)).toEqual(["a", "b"]);
  });

  it("never lets the person's own text act as the marker", () => {
    expect(EMAIL_MARKER).not.toMatch(/[\w@.\-+]/);
  });
});
