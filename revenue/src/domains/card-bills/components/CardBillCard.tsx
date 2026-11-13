import { Badge, Button, Card, CardContent, CardHeader, CardLabel } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { CalendarCog, CreditCard, Landmark, Sigma } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../bills/logic/month";
import type { CardBill, CardSource, CardTransaction } from "../api";
import { CardRowsList, CardRowsTable } from "./CardRows";

interface Props {
  bill: CardBill;
  /** The card's Source, for its days; absent while the status is not read. */
  source: CardSource | undefined;
  /** This card's rows that count in the bill's month. */
  rows: CardTransaction[];
  rowsFailed: boolean;
  monthName: string;
  desktop: boolean;
  onEditDays(): void;
}

/**
 * One card's bill: the bank's total or the app's sum of the card's charges plus the known installments, closed or
 * open; the badge says which state and the line under the amount which source, so the number is never bare.
 */
export function CardBillCard({ bill, source, rows, rowsFailed, monthName, desktop, onEditDays }: Props) {
  const { t, locale } = useI18n();
  const caption = t("cardBills.rows.caption", { name: bill.name, month: monthName });
  const Rows = desktop ? CardRowsTable : CardRowsList;
  const date = (key: "cardBills.dueOn" | "cardBills.closesOn", day: string | null) => day && t(key, { date: formatDay(day, locale) });
  const dates = [date("cardBills.closesOn", bill.closesOn), date("cardBills.dueOn", bill.dueOn)].filter(Boolean);
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardLabel className="flex min-w-0 items-center gap-2">
            <CreditCard className="size-4 shrink-0" aria-hidden />
            <h2 id={`card-${bill.sourceId}`} className="section-title [overflow-wrap:anywhere]">{bill.name}</h2>
          </CardLabel>
          <Badge icon={bill.fromBank ? Landmark : Sigma} tone="neutral">{t(bill.fromBank || bill.closed ? "cardBills.kind.closed" : "cardBills.kind.open")}</Badge>
        </div>
        <Amount cents={bill.amountCents} size="lg" locale={locale} />
        <p className="caption text-text-muted">{t(bill.fromBank ? "cardBills.source.bank" : "cardBills.source.app")}</p>
        {dates.length > 0 && <p className="caption text-text-muted">{dates.join(" · ")}</p>}
        {!bill.billDaysKnown && <p className="caption text-text-muted">{t("cardBills.noDays")}</p>}
      </CardHeader>
      <CardContent>
        <h3 className="body-strong">{t("cardBills.rows.heading")}</h3>
        {rowsFailed ? (
          <p className="caption text-text-muted">{t("cardBills.rows.failed")}</p>
        ) : rows.length === 0 ? (
          <p className="caption text-text-muted">{t("cardBills.rows.none")}</p>
        ) : (
          <Rows rows={rows} caption={caption} />
        )}
      </CardContent>
      {source && (
        <div>
          <Button variant="secondary" icon={CalendarCog} onClick={onEditDays}>
            {t("cardBills.days.edit")}<span className="sr-only">: {bill.name}</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
