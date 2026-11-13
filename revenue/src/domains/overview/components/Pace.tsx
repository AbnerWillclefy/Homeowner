import { Card, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { formatAmount, PaceChart } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Pace as PaceData } from "../api/api";
import { daysInMonth } from "../logic/month";
import { paceView } from "../logic/pace";

/** Money spent so far against the straight line to the month's end. Every value is also in a table for screen readers. */
export function Pace({ pace, month }: { pace: PaceData; month: string }) {
  const { t, locale } = useI18n();
  const days = daysInMonth(month);
  const view = paceView(pace, days);
  const money = (cents: number) => formatAmount(cents, { locale });
  const amount = money(view.gapCents);
  const table = (
    <Table>
      <TableCaption>{t("overview.pace.caption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("overview.pace.day")}</TableHead>
          <TableHead align="end">{t("overview.pace.spent")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {view.points.map((p) => (
          <TableRow key={p.day}>
            <TableCell>{p.day}</TableCell>
            <TableCell align="end">{money(p.cents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return (
    <Card>
      <h2 className="section-title">{t("overview.pace.heading")}</h2>
      {view.points.length === 0 ? (
        <p className="text-text-muted">{t("overview.pace.empty")}</p>
      ) : (
        <PaceChart
          days={days}
          limitCents={pace.lineEndCents}
          spent={view.points}
          locale={locale}
          label={t(view.over ? "overview.pace.over" : "overview.pace.under", { amount })}
          markerLabel={t(view.over ? "overview.pace.markerOver" : "overview.pace.markerUnder", { amount })}
          alternative={table}
        />
      )}
      <p className="caption text-text-muted">{t("overview.pace.line", { amount: money(pace.lineEndCents) })}</p>
    </Card>
  );
}
