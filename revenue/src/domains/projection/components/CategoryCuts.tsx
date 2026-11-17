import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMoney } from "../hooks/useMoney";
import { categoryName } from "../logic/labels";
import type { ProjectionRow } from "../logic/projectionRow";

/**
 * Each category with a Spending limit: its plan, its pace and, when the pace is over the plan, how much to cut. Plain
 * ink, no badge: it informs, it does not warn. Renders nothing when no category has a limit.
 */
export function CategoryCuts({ cuts }: { cuts: ProjectionRow["cuts"] }) {
  const { t } = useI18n();
  const money = useMoney();
  if (cuts.length === 0) return null;

  return (
    <ul aria-label={t("projection.cuts")} className="flex list-none flex-col gap-2 p-0">
      {cuts.map((c) => (
        <li key={c.category} className="flex flex-col gap-0.5">
          <span className="body-strong [overflow-wrap:anywhere]">{categoryName(t, c.category)}</span>
          <span className="flex flex-wrap gap-x-3 text-text-muted tabular-nums">
            <span>{t("projection.cuts.plan")} {money(c.planCents)}</span>
            <span>{t("projection.cuts.pace")} {money(c.paceCents)}</span>
            {c.cutCents > 0 && <span className="text-text">{t("projection.cuts.cut")} {money(c.cutCents)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
