import { useI18n } from "../../../shared/i18n";
import type { DayPlan } from "../api/api";
import { EXPLANATION_SOURCES } from "../logic/explanationSource";

/**
 * Why the Day Plan looks this way, as one muted line right under "Your Tasks": the headline, which wraps and is
 * never cut. Who wrote it (the assistant or the standard template) is a small icon for sighted users and the same
 * words as visually hidden text for screen readers, so it is never colour- or icon-only. The headline is server data
 * in both languages, picked by Locale and never through the catalog. Nothing renders without an explanation.
 */
export function DaySummary({ plan }: { plan: DayPlan }) {
  const { locale, t } = useI18n();
  const { explanation } = plan;
  if (!explanation) return null;
  const { icon: SourceIcon, labelKey } = EXPLANATION_SOURCES[explanation.source];
  return (
    <p className="my-0 text-muted [overflow-wrap:anywhere]">
      <SourceIcon aria-hidden="true" size={16} className="mr-2 inline-block align-text-bottom" />
      <span className="sr-only">{t(labelKey)}. </span>
      {explanation.headline[locale]}
    </p>
  );
}
