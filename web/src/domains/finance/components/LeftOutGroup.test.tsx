// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n";
import type { Transaction } from "../api/api";
import { LeftOutGroup } from "./LeftOutGroup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tx = (id: string, amountCents: number): Transaction => ({
  id, postedOn: "2026-03-10", countsOn: "2026-03-10", description: id, sourceName: "Bank", amountCents,
  currency: "BRL", type: "saving", spendingCategory: null, categorySetBy: null,
});

it("totals the saving group net of withdrawals: a deposit adds, a Resgate subtracts", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const savings = [tx("deposit", -50000), tx("resgate", 20000)];
  act(() => root.render(createElement(I18nProvider, null, createElement(LeftOutGroup, { transfers: [], savings, income: [], onEdit: vi.fn() }))));
  expect(container.querySelector("button[aria-expanded]")!.textContent).toMatch(/R\$300\.00/);
  act(() => root.unmount());
  container.remove();
});
