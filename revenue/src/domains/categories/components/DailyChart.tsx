import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, BarChart } from "@homeowner/bedrock/finance";
import { useHideValues, useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { DayPoint } from "../logic/daily";

/** The month's spending day by day, with its 7-day average and the pace of the limits. The table is its text alternative. */
export function DailyChart({ days, targetCents, month }: { days: DayPoint[]; targetCents: number | undefined; month: string }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { hidden: isHidden } = useHideValues();
  const biggest = days.reduce((top, d) => (d.cents > top.cents ? d : top), days[0]!);
  const label = t("categories.chart.label", { month, day: biggest.label });
  const table = (
    <Table>
      <TableCaption>{label}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("categories.col.day")}</TableHead>
          <TableHead align="end">{t("categories.col.spent")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {days.map((d) => (
          <TableRow key={d.label}>
            <TableCell>{d.label}</TableCell>
            <TableCell align="end"><Amount cents={d.cents} size="sm" locale={locale} {...hidden} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  // The chart's axis and tooltip print amounts and cannot hide them, so a hidden screen shows only the table.
  if (isHidden) return table;
  return (
    <BarChart
      data={days}
      targetCents={targetCents}
      label={label}
      legend={{ daily: t("categories.chart.daily"), average: t("categories.chart.average"), target: t("categories.chart.target") }}
      locale={locale}
      alternative={table}
    />
  );
}
