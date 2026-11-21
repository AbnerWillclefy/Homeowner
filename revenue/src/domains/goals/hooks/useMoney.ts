import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useHideValues } from "../../../shared/HideValues";

/** Money as text for sentences and spoken values, which Bedrock's `Amount` cannot be put in: it follows the hide-values toggle. */
export function useMoney() {
  const { locale } = useI18n();
  const { hidden } = useHideValues();
  return (cents: number, precision: "cents" | "whole" = "cents") => (hidden ? "R$ ••••" : formatAmount(cents, { locale, precision }));
}
