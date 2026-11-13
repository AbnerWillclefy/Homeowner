import { ProgressBar } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { limitText } from "../logic/limit";

/**
 * Spent against the Spending limit. Past the limit the bar is full and the words say by how much: no colour carries
 * it, so the tone is fixed and never alarms.
 */
export function LimitBar({ label, spent, limit }: { label: string; spent: number; limit: number }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatAmount(cents, { locale });
  const standing = limitText(spent, limit);
  const of = t("categories.limit.of", { spent: money(spent), limit: money(limit) });
  const words = t(`categories.limit.${standing.key}`, { amount: money(standing.amount), limit: money(limit) });
  return (
    <ProgressBar value={Math.max(spent, 0)} max={limit} tone="brand" label={label} valueText={`${of}. ${words}`} start={of} end={words} />
  );
}
