import { Banner, Button, Sheet } from "@homeowner/bedrock";
import { Amount, formatAmount, ListRow } from "@homeowner/bedrock/finance";
import { Check, ChevronRight, Receipt } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill } from "../../bills/api";
import { BillStatus } from "../../bills/components/BillStatus";
import { billState } from "../../bills/logic/billState";
import { billsAlert } from "../logic/billsAlert";
import { formatDay } from "../logic/month";

const tile = (
  <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted">
    <Receipt className="size-4" />
  </span>
);

interface Props {
  bills: Bill[];
  /** São Paulo's day for the current month; null for a past month, which is read-only. */
  today: string | null;
  setPaid(bill: Bill, paid: boolean): Promise<void>;
  /** What the last failed write said, shown in the panel. */
  notice: "failed" | "gone" | null;
}

/**
 * The unpaid Bills as one button that opens them in a side panel (a bottom sheet on a phone). The panel marks them paid in one tap
 * and undoes that; it is the Bills screen's own `useBills`, so the sidebar badge and the Bills screen follow.
 */
export function BillsAlert({ bills, today, setPaid, notice }: Props) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { hidden: isHidden } = useHideValues();
  const [open, setOpen] = useState(false);
  // The Bills marked from the panel, kept so the panel still lists them, now paid, and can undo.
  const [batch, setBatch] = useState<Bill[] | null>(null);

  if (bills.length === 0) return <p className="rounded-lg border border-border bg-surface p-4 text-text-muted">{t("overview.bills.none")}</p>;

  const alert = billsAlert(bills, today);
  const live = (b: Bill) => bills.find((x) => x.id === b.id) ?? b;
  const rows = batch ?? (alert.unpaid.length > 0 ? alert.unpaid : [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
  const toPay = rows.filter((b) => !live(b).paid).length;
  const count = (n: number, one: MessageKey, many: MessageKey) => (n === 1 ? t(one) : t(many, { count: n }));

  const first = alert.daysToFirst === null ? null : alert.daysToFirst < 0 ? t("overview.bills.firstLate", { date: formatDay(alert.firstDue!, locale) })
    : alert.daysToFirst === 0 ? t("overview.bills.firstToday")
    : alert.daysToFirst === 1 ? t("overview.bills.firstTomorrow")
    : t("overview.bills.firstIn", { days: alert.daysToFirst });
  const subtitle = toPay === 0 || alert.lastDue === null ? undefined
    : [isHidden ? null : formatAmount(alert.totalCents, { locale }), t("overview.bills.until", { date: formatDay(alert.lastDue, locale) })].filter(Boolean).join(" · ");

  const markAll = () => {
    setBatch(alert.unpaid);
    return Promise.all(alert.unpaid.map((b) => setPaid(b, true)));
  };
  const undo = async () => {
    const marked = batch ?? [];
    setBatch(null);
    await Promise.all(marked.map((b) => setPaid(live(b), false)));
  };
  const allMarked = batch !== null && toPay === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      closeLabel={t("app.close")}
      title={toPay > 0 ? count(toPay, "overview.bills.toPayOne", "overview.bills.toPayMany") : count(rows.length, "overview.bills.panelPaidOne", "overview.bills.panelPaidMany")}
      subtitle={subtitle}
      trigger={
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-4 rounded-lg border border-border bg-surface p-4 text-left text-text outline-none motion-safe:transition-colors duration-(--duration-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {tile}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="body-strong">{alert.unpaid.length > 0 ? count(alert.unpaid.length, "overview.bills.toPayOne", "overview.bills.toPayMany") : t("overview.bills.allPaid")}</span>
            {alert.unpaid.length > 0 && (
              <span className="caption inline-flex flex-wrap items-baseline gap-x-1 text-warning">
                <Amount cents={alert.totalCents} size="sm" locale={locale} {...hidden} />
                {first && " "}
                {first && ` · ${first}`}
              </span>
            )}
          </span>
          <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden />
        </button>
      }
      footer={
        <div className="flex flex-col gap-2">
          {today !== null && allMarked && (
            <Button variant="success" size="lg" icon={Check} onClick={() => void undo()}>
              {count(batch?.length ?? 0, "overview.bills.paidOne", "overview.bills.paidMany")}
            </Button>
          )}
          {today !== null && toPay > 0 && (
            <Button size="lg" icon={Check} onClick={() => void markAll()}>
              {toPay === 1 ? t("overview.bills.markOne") : t("overview.bills.markAll", { count: toPay })}
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link to="/bills">{t("overview.bills.allBills")}</Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {notice && <Banner tone="danger">{t(notice === "gone" ? "bills.gone" : "bills.failed")}</Banner>}
        <ul className="divide-y divide-border">
          {rows.map((b) => {
            const bill = live(b);
            const overdue = today !== null && !bill.paid && bill.dueDate < today;
            const date = formatDay(bill.dueDate, locale);
            return (
              <li key={bill.id}>
                <ListRow
                  leading={tile}
                  title={bill.name}
                  subtitle={t(overdue ? "overview.bills.overdue" : "overview.bills.due", { date })}
                  cents={bill.paidCents ?? bill.expectedCents}
                  end={<BillStatus state={billState(bill, today)} />}
                  locale={locale}
                  {...hidden}
                />
              </li>
            );
          })}
        </ul>
        <p className="caption text-text-muted">{t("overview.bills.note")}</p>
      </div>
    </Sheet>
  );
}
