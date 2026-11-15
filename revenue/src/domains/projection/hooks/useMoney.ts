import { formatAmount } from "@homeowner/bedrock/finance";
import { useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/** Cents as text for a place that cannot take an `Amount` (a sentence, an axis): "hidden value" while the toggle is on. */
export function useMoney(options: { precision?: "cents" | "compact" } = {}) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  return (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale, ...options }));
}
