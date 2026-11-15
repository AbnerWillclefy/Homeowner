import { Amount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useHiddenProps } from "../../../shared/HideValues";
import type { Transaction } from "../api";

/** What a row shows as money: an Expense as what it cost (a refund comes out negative), the rest as the bank signed it. */
export function Money({ tx, size }: { tx: Transaction; size: "sm" | "lg" }) {
  const { locale } = useI18n();
  return (
    <Amount cents={tx.type === "expense" ? -tx.amountCents : tx.amountCents} income={tx.type === "income"} size={size} locale={locale} {...useHiddenProps()} />
  );
}
