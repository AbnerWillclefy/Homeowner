import { Button, Card } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill } from "../api/api";
import { formatDay } from "../logic/month";
import { DueStrip } from "./DueStrip";

/** The month's due dates, and the Bills still to pay in due order. */
export function BillsBlock({ bills, month, today }: { bills: Bill[]; month: string; today: string | null }) {
  const { t, locale } = useI18n();
  const next = bills.filter((b) => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  return (
    <Card>
      <h2 className="section-title">{t("overview.bills.heading")}</h2>
      {bills.length === 0 ? (
        <p className="text-text-muted">{t("overview.bills.none")}</p>
      ) : (
        <>
          <DueStrip bills={bills} month={month} today={today} />
          <ul className="flex flex-col">
            {next.map((bill) => {
              const date = formatDay(bill.dueDate, locale);
              const overdue = today !== null && bill.dueDate < today;
              return (
                <li key={bill.id} className="flex flex-wrap items-center gap-x-3 border-t border-border py-2 first:border-t-0">
                  <span className="flex min-w-0 flex-1 basis-32 flex-col">
                    <span className="body-strong [overflow-wrap:anywhere]">{bill.name}</span>
                    <span className="caption text-text-muted">{t(overdue ? "overview.bills.overdue" : "overview.bills.due", { date })}</span>
                  </span>
                  <span className="body-strong ms-auto tabular-nums">{formatAmount(bill.expectedCents, { locale })}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Button asChild variant="ghost" className="self-start">
        <Link to="/bills">{t("overview.bills.all")}</Link>
      </Button>
    </Card>
  );
}
