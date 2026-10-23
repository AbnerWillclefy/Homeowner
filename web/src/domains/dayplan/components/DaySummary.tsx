import { Inbox, ListChecks, Users } from "lucide-react";
import { useId } from "react";
import { useI18n } from "../../../shared/i18n";
import { CollapsibleCard } from "../../../shared/ui/CollapsibleCard";
import { Fact, FactIcon, FactList } from "../../chores/components/FactList";
import type { DayPlan } from "../api/api";
import { EXPLANATION_SOURCES } from "../logic/explanationSource";
import { summaryCounts } from "../logic/summaryCounts";

/**
 * Why the Day Plan looks this way, folded into one line under "Your Tasks". Closed, the card shows only the
 * headline (it wraps, never cut); open, it shows the detail, the counts and a caption naming who wrote the text.
 * The small icon and its hidden description say the same thing, in neutral colours. The headline and detail are
 * server data in both languages, so they are picked by Locale and never pass through the catalog; only the counts'
 * and the source's wording do. A count of zero is left out, and with none left there is no list (an empty list is
 * announced as "list, 0 items"). The open state is the card's own, so it is not remembered. Nothing renders when
 * there is no explanation.
 */
export function DaySummary({ plan }: { plan: DayPlan }) {
  const { locale, t } = useI18n();
  const id = useId();
  const { explanation } = plan;
  if (!explanation) return null;
  const counts = summaryCounts(plan);
  const rows = [
    { key: "dayplan.summary.mine", icon: ListChecks, count: counts.mine },
    { key: "dayplan.summary.others", icon: Users, count: counts.others },
    { key: "dayplan.summary.pool", icon: Inbox, count: counts.pool },
  ] as const;
  const shown = rows.filter((row) => row.count > 0);
  const { icon: SourceIcon, labelKey } = EXPLANATION_SOURCES[explanation.source];
  const label = t(labelKey);
  return (
    <CollapsibleCard
      id={id}
      icon={SourceIcon}
      iconLabel={label}
      tone="neutral"
      headingLevel={4}
      className="mb-3"
      title={explanation.headline[locale]}
    >
      <p className="my-0 text-muted [overflow-wrap:anywhere]">{explanation.detail[locale]}</p>
      {shown.length > 0 ? (
        <div className="text-muted">
          <FactList>
            {shown.map(({ key, icon, count }) => (
              <Fact key={key} icon={<FactIcon icon={icon} />}>
                {t(key, { count })}
              </Fact>
            ))}
          </FactList>
        </div>
      ) : null}
      <p className="my-0 flex items-center gap-2 text-sm text-muted">
        <SourceIcon aria-hidden="true" size={16} className="shrink-0" />
        {label}
      </p>
    </CollapsibleCard>
  );
}
