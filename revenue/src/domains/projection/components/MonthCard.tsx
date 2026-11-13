import { Card } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { ChevronDown } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CommitmentMonth } from "../../overview/api/api";
import { monthLabel } from "../../overview/logic/month";
import { monthRows } from "../../overview/logic/monthRows";
import { groupLabel, itemName } from "../logic/labels";

/**
 * One month for a phone: Total and Leftover under the title (so the twelve Leftovers read down one edge, open or
 * closed), and, open, each group with its lines and the Monthly income last. Neutral: a total above the income is a
 * minus sign and one muted sentence, never a danger colour.
 */
export function MonthCard({ data, current, income }: { data: CommitmentMonth; current: boolean; income: number | null }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatAmount(cents, { locale });
  const rows = monthRows(data);

  return (
    <Card variant="compact" className="gap-0">
      <details open={current} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-1 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-3">
            <span className="body-strong">
              {monthLabel(data.month, locale)}
              {current && <span className="caption ms-2 text-text-muted">{t("projection.thisMonth")}</span>}
            </span>
            <ChevronDown aria-hidden className="size-5 shrink-0 text-text-muted motion-safe:transition-transform duration-(--duration-fast) group-open:rotate-180" />
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>
              <span className="text-text-muted">{t("projection.total")}</span> <span className="body-strong tabular-nums">{money(rows.totalCents)}</span>
            </span>
            {rows.leftoverCents !== null && (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-text-muted">{t("projection.leftover")}</span>
                <Amount cents={rows.leftoverCents} size="md" locale={locale} />
              </span>
            )}
          </span>
          {rows.overCents > 0 && <span className="caption text-text-muted">{t("projection.short", { amount: money(rows.overCents) })}</span>}
        </summary>
        <ul className="mt-3 flex list-none flex-col gap-3 border-t border-border p-0 pt-3">
          {rows.groups.map((g) => (
            <li key={g.id} className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="body-strong [overflow-wrap:anywhere]">{groupLabel(t, g.id, current)}</span>
                <span className="body-strong tabular-nums">{money(g.cents)}</span>
              </p>
              {g.id === "cards" && g.items.length === 0 && <p className="caption text-text-muted">{t("projection.noCard")}</p>}
              {g.items.length > 0 && (
                <ul className="flex list-none flex-col gap-1 p-0 text-text-muted">
                  {g.items.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        {itemName(t, item)}
                        {item.kind === "bill" && item.paid && ` · ${t("projection.paid")}`}
                      </span>
                      <span className="tabular-nums">{money(item.cents)}</span>
                      {item.kind === "card" && !item.daysKnown && <span className="caption basis-full">{t("projection.noDays")}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {income !== null && (
          <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-3 text-text-muted">
            <span>{t("overview.leftover.income")}</span>
            <span className="tabular-nums">{money(income)}</span>
          </p>
        )}
      </details>
    </Card>
  );
}
