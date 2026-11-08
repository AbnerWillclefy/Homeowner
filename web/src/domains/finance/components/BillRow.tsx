import { CalendarClock, CircleCheck, Clock, Landmark } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Card } from "../../../shared/ui/Card";
import type { Bill } from "../api/api";
import { BILL_STATE_KEY, billState, type BillState } from "../logic/billState";
import { formatCents } from "../logic/money";
import { formatDay } from "../logic/month";

const ICON = { "paid-bank": Landmark, "paid-hand": CircleCheck, due: Clock, overdue: CalendarClock } satisfies Record<BillState, unknown>;

interface Props {
  bill: Bill;
  /** `YYYY-MM-DD`. */
  today: string;
  /** A write on this Bill is running. */
  busy: boolean;
  onPaid(paid: boolean): void;
  onEdit(): void;
  onDelete(): void;
}

/**
 * One Bill as a card. The state is told in words with an icon, never by colour: overdue is a plain sentence in the
 * ordinary text colour. Mark paid / Undo sits at the right, the primary last; Edit and Delete are secondary on the left.
 */
export function BillRow({ bill, today, busy, onPaid, onEdit, onDelete }: Props) {
  const { t, locale } = useI18n();
  const state = billState(bill, today);
  const Icon = ICON[state];
  const date = formatDay(bill.dueDate, locale);
  const label = state === "overdue" ? t("finances.bills.state.overdue", { date }) : t(BILL_STATE_KEY[state]);
  return (
    <li className="m-0 list-none">
      <Card className="flex flex-col gap-2">
        <p className="my-0 font-semibold [overflow-wrap:anywhere]">{bill.name}</p>
        <p className="my-0">{formatCents(bill.expectedCents, locale)}</p>
        <p className="my-0 text-sm text-muted">{t("finances.bills.due", { date })}</p>
        <p className="my-0 flex items-start gap-2 font-semibold">
          <Icon aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span>{label}</span>
        </p>
        <ButtonRow
          className="mt-2"
          start={
            <>
              <Button variant="secondary" disabled={busy} aria-label={t("finances.bills.edit.label", { name: bill.name })} onClick={onEdit}>
                {t("finances.bills.edit")}
              </Button>
              <Button variant="secondary" disabled={busy} aria-label={t("finances.bills.delete.label", { name: bill.name })} onClick={onDelete}>
                {t("finances.bills.delete")}
              </Button>
            </>
          }
          end={
            state === "paid-bank" ? undefined : state === "paid-hand" ? (
              <Button variant="secondary" pending={busy} aria-label={t("finances.bills.undo.label", { name: bill.name })} onClick={() => onPaid(false)}>
                {t("finances.bills.undo")}
              </Button>
            ) : (
              <Button pending={busy} aria-label={t("finances.bills.markPaid.label", { name: bill.name })} onClick={() => onPaid(true)}>
                {t("finances.bills.markPaid")}
              </Button>
            )
          }
        />
      </Card>
    </li>
  );
}
