import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, formatAmount, PaceChart } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Pace } from "../api/api";
import { daysInMonth } from "../logic/month";
import { paceView } from "../logic/pace";

/**
 * Money spent so far against the straight line to the month's end, on the hero card. Every value is also in a table for screen
 * readers. With values hidden the sentences carry no amount and the chart ignores the pointer, so its tooltip stays shut.
 */
export function PaceView({ pace, month }: { pace: Pace; month: string }) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const days = daysInMonth(month);
  const view = paceView(pace, days);
  if (view.points.length === 0) return <p className="caption text-text-muted">{t("overview.pace.empty")}</p>;
  const amount = formatAmount(view.gapCents, { locale });
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
            <TableCell align="end"><Amount cents={p.cents} size="sm" locale={locale} {...hiddenProps} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  const wording = hidden ? (view.over ? "overview.pace.overHidden" : "overview.pace.underHidden") : null;
  return (
    <div className={hidden ? "pointer-events-none" : undefined}>
      <PaceChart
        variant="hero"
        days={days}
        limitCents={pace.lineEndCents}
        spent={view.points}
        locale={locale}
        label={wording ? t(wording) : t(view.over ? "overview.pace.over" : "overview.pace.under", { amount })}
        markerLabel={wording ? t(wording) : t(view.over ? "overview.pace.markerOver" : "overview.pace.markerUnder", { amount })}
        alternative={table}
      />
    </div>
  );
}
