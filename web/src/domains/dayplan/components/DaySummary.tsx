import { Inbox, ListChecks, Users } from "lucide-react";
import { useId } from "react";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import { Fact, FactIcon, FactList } from "../../chores/components/FactList";
import type { Explanation } from "../api/api";
import type { SummaryCounts } from "../logic/summaryCounts";

/**
 * A calm summary of the day, after the Check-in card: the headline as the card's title, the detail, then short
 * counts. The headline and detail are server data in both languages, so they are picked by Locale and never
 * pass through the catalog; only the counts' wording does. A count of zero is left out, and with none left there
 * is no list (an empty list is announced as "list, 0 items"). Neutral colours always, even on a Drained day.
 * Nothing renders when there is no explanation.
 */
export function DaySummary({
  explanation,
  counts,
}: {
  explanation: Explanation | null | undefined;
  counts: SummaryCounts;
}) {
  const { locale, t } = useI18n();
  const titleId = useId();
  if (!explanation) return null;
  const { mine, others, pool } = counts;
  return (
    <Card as="section" aria-labelledby={titleId} className="mb-6">
      <h3 id={titleId} className="m-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {explanation.headline[locale]}
      </h3>
      <p className="mt-1 mb-0 text-muted [overflow-wrap:anywhere]">{explanation.detail[locale]}</p>
      {mine + others + pool > 0 ? (
        <div className="mt-3 text-muted">
          <FactList>
            {mine > 0 ? (
              <Fact icon={<FactIcon icon={ListChecks} />}>{t("dayplan.summary.mine", { count: mine })}</Fact>
            ) : null}
            {others > 0 ? (
              <Fact icon={<FactIcon icon={Users} />}>{t("dayplan.summary.others", { count: others })}</Fact>
            ) : null}
            {pool > 0 ? <Fact icon={<FactIcon icon={Inbox} />}>{t("dayplan.summary.pool", { count: pool })}</Fact> : null}
          </FactList>
        </div>
      ) : null}
    </Card>
  );
}
