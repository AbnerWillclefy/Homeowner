import { useI18n } from "../../../shared/i18n";
import { CollapsibleCard } from "../../../shared/ui/CollapsibleCard";
import type { CommitmentMonth } from "../api/api";
import { formatCents } from "../logic/money";
import { monthLabel } from "../logic/month";
import { monthRows, type RowGroup, type RowItem } from "../logic/monthRows";
import { SPENDING_CATEGORIES, spendingKey, type SpendingCategory } from "../logic/spendingCategories";

const GROUP_KEY = {
  cards: "finances.commit.group.cards",
  bills: "finances.commit.group.bills",
  planned: "finances.commit.group.planned",
  spent: "finances.commit.group.spent",
  saving: "finances.commit.group.saving",
} as const;
const ROW ="flex flex-wrap items-baseline justify-between gap-x-3";

/**
 * One month of "Próximos meses": the title with Total and Leftover under it (so the twelve leftovers read down one
 * edge, open or closed), and, open, each group with its lines and the Monthly income last. Neutral by rule: a total
 * above the income is a negative leftover and one muted sentence, never a danger colour or icon.
 */
export function MonthCard({ data, current, income }: { data: CommitmentMonth; current: boolean; income: number | null }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatCents(cents, locale);
  const rows = monthRows(data);
  const itemName = (item: RowItem) => {
    if (item.kind === "offCardInstallments") return t("finances.commit.offCardInstallments");
    if (item.kind === "planned") return (SPENDING_CATEGORIES as readonly string[]).includes(item.category) ? t(spendingKey(item.category as SpendingCategory)) : item.category;
    return item.name;
  };
  const groupLabel = (g: RowGroup) => t(g.id === "planned" && current ? "finances.commit.group.plannedCurrent" : GROUP_KEY[g.id]);

  return (
    <CollapsibleCard
      id={`finances-commit-${data.month}`}
      headingLevel={4}
      defaultOpen={current}
      title={
        <>
          {monthLabel(data.month, locale)}
          {current && <span className="ms-2 text-sm font-semibold text-muted">{t("finances.commit.thisMonth")}</span>}
        </>
      }
      hint={
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span>
            {t("finances.commit.total")} <span className="font-bold text-text">{money(rows.totalCents)}</span>
          </span>
          {rows.leftoverCents !== null && (
            <span className="text-end">
              {t("finances.commit.leftover")} <span className="text-lg font-bold text-text">{money(rows.leftoverCents)}</span>
            </span>
          )}
        </span>
      }
    >
      {rows.overCents > 0 && <p className="my-0 text-sm text-muted">{t("finances.commit.over", { amount: money(rows.overCents) })}</p>}
      <ul className="m-0 flex list-none flex-col gap-3 border-t border-border p-0 pt-3">
        {rows.groups.map((g) => (
          <li key={g.id} className="flex flex-col gap-1">
            <p className={`${ROW} my-0`}>
              <span className="font-semibold [overflow-wrap:anywhere]">{groupLabel(g)}</span>{" "}
              <span className="font-bold">{money(g.cents)}</span>
            </p>
            {g.id === "cards" && g.items.length === 0 && <p className="my-0 text-sm text-muted">{t("finances.commit.noCard")}</p>}
            {g.items.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-muted">
                {g.items.map((item) => (
                  <li key={item.key} className={ROW}>
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {itemName(item)}
                      {item.kind === "bill" && item.paid && ` · ${t("finances.commit.paid")}`}
                    </span>{" "}
                    <span>{money(item.cents)}</span>
                    {item.kind === "card" && !item.daysKnown && <span className="basis-full">{t("finances.commit.noDays")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {income !== null && (
        <p className={`${ROW} my-0 border-t border-border pt-3 text-sm text-muted`}>
          <span>{t("finances.commit.monthlyIncome")}</span>{" "}
          <span>{money(income)}</span>
        </p>
      )}
    </CollapsibleCard>
  );
}
