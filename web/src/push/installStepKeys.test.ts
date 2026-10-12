import { describe, expect, it } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { ptBR } from "../i18n/catalogs/pt-BR";
import { INSTALL_STEP_KEYS } from "./installStepKeys";

describe("INSTALL_STEP_KEYS", () => {
  it("lists the four steps in order", () => {
    expect(INSTALL_STEP_KEYS).toEqual(["install.step1", "install.step2", "install.step3", "install.step4"]);
  });

  it("has text for every step in both languages", () => {
    for (const key of INSTALL_STEP_KEYS) {
      expect(enUS[key]).toBeTruthy();
      expect(ptBR[key]).toBeTruthy();
    }
  });
});
