import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Amount, formatAmount } from "./amount";

const NBSP = " ";
// Testing Library folds U+00A0 into a plain space by default; the non-breaking space is the point here.
const exact = (text: string) => screen.getByText(text, { normalizer: (s) => s });

it("formats cents with a non-breaking space after the symbol", () => {
  expect(formatAmount(218341)).toBe(`R$${NBSP}2.183,41`);
});

it("puts a plus on income and none on zero", () => {
  expect(formatAmount(218341, { income: true })).toBe(`+R$${NBSP}2.183,41`);
  expect(formatAmount(0, { income: true })).toBe(`R$${NBSP}0,00`);
});

it("keeps the minus of a negative amount", () => {
  expect(formatAmount(-5000)).toBe(`-R$${NBSP}50,00`);
});

it("rounds the whole form", () => {
  expect(formatAmount(498300, { precision: "whole" })).toBe(`R$${NBSP}4.983`);
});

it("compacts thousands to k and millions to mi", () => {
  expect(formatAmount(800000, { precision: "compact" })).toBe(`R$${NBSP}8k`);
  expect(formatAmount(1250000, { precision: "compact" })).toBe(`R$${NBSP}12,5k`);
  expect(formatAmount(120000000, { precision: "compact" })).toBe(`R$${NBSP}1,2${NBSP}mi`);
  expect(formatAmount(49900, { precision: "compact" })).toBe(`R$${NBSP}499`);
  expect(formatAmount(99_995_000, { precision: "compact" })).not.toMatch(/k$/);
  expect(formatAmount(-800000, { precision: "compact" })).toBe(`-R$${NBSP}8k`);
  expect(formatAmount(800000, { precision: "compact", income: true })).toBe(`+R$${NBSP}8k`);
});

it("shows R$ in English too", () => {
  expect(formatAmount(218341, { locale: "en" })).toBe(`R$2,183.41`);
  expect(formatAmount(800000, { locale: "en", precision: "compact" })).toBe(`R$${NBSP}8k`);
});

it("renders the value, the income tone and the reference", () => {
  render(<Amount cents={218341} size="md" income reference={498300} />);
  const value = exact(`+R$${NBSP}2.183,41`);
  expect(value.className).toContain("text-positive");
  expect(value.className).toContain("whitespace-nowrap");
  expect(exact(`/ R$${NBSP}4.983`).className).toContain("text-text-muted");
});

it("never colours spending red", () => {
  render(<Amount cents={218341} size="sm" />);
  expect(exact(`R$${NBSP}2.183,41`).className).not.toMatch(/danger|red/);
});

it("hides the digits and speaks the label", () => {
  const { container } = render(<Amount cents={218341} size="lg" hidden hiddenLabel="Valor oculto" />);
  expect(exact(`R$${NBSP}••••`).closest("[aria-hidden='true']")).not.toBeNull();
  expect(screen.getByText("Valor oculto").className).toContain("sr-only");
  expect(container.innerHTML).not.toContain("2.183");
});
