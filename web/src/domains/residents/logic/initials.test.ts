import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("gives one letter for a one-word name", () => {
    expect(initials("Abner")).toBe("A");
  });

  it("gives the first letters of the first and last word of a longer name", () => {
    expect(initials("Ana Souza")).toBe("AS");
    expect(initials("Maria da Silva Costa")).toBe("MC");
  });

  it("splits an email-like local part on dots, underscores, hyphens and plus signs", () => {
    expect(initials("abner.w")).toBe("AW");
    expect(initials("bruna_souza")).toBe("BS");
    expect(initials("ana-clara")).toBe("AC");
    expect(initials("joao+casa")).toBe("JC");
  });

  it("ignores extra spaces and separators", () => {
    expect(initials("  ana   souza ")).toBe("AS");
    expect(initials("..ana..")).toBe("A");
  });

  it("keeps an accented first letter whole", () => {
    expect(initials("élio")).toBe("É");
    expect(initials("Ângela Maria")).toBe("ÂM");
  });

  it("does not cut an emoji in half", () => {
    expect(initials("🙂 Ana")).toBe("🙂A");
    expect(initials("👩🏽‍🦰")).toBe("👩🏽‍🦰");
  });

  it("is empty for an empty or blank name", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
    expect(initials("._-")).toBe("");
  });
});
