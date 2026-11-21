import { ChartContainer, ChartTooltipContent, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { NetWorthPoint } from "../api";

/**
 * Balances plus Investments per day, as an area with three grid lines, its values on the right, and the first day and "today" under it.
 * Draws only the points it is given, so days before the first sync stay empty; the table holds every value.
 * A hidden value leaves the axis, tooltip, label and table.
 */
export function NetWorthLine({ series }: { series: NetWorthPoint[] }) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const first = series[0]!;
  const last = series.at(-1)!;
  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  const label = t("netWorth.lineLabel", { from: money(first.cents), fromDay: formatDay(first.day, locale), to: money(last.cents), toDay: formatDay(last.day, locale) });

  return (
    <div className="flex flex-col gap-1">
      <ChartContainer
        label={label}
        className="h-60"
        alternative={
          <Table>
            <TableCaption>{t("netWorth.table")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("netWorth.table.day")}</TableHead>
                <TableHead align="end">{t("netWorth.table.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((p) => (
                <TableRow key={p.day}>
                  <TableCell>{formatDay(p.day, locale)}</TableCell>
                  <TableCell align="end">{money(p.cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <AreaChart accessibilityLayer={false} data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" hide />
          <YAxis orientation="right" hide={hidden} tickCount={3} tickLine={false} axisLine={false} width={72} domain={["auto", "auto"]} tickFormatter={(c: number) => formatAmount(c, { locale, precision: "compact" })} />
          <Area dataKey="cents" type="monotone" stroke="var(--brand)" strokeWidth={2.5} fill="var(--brand)" fillOpacity={0.12} dot={false} />
          <Tooltip content={<ChartTooltipContent formatValue={money} />} labelFormatter={(d) => formatDay(String(d), locale)} />
        </AreaChart>
      </ChartContainer>
      <div aria-hidden className="caption flex justify-between text-text-muted">
        <span>{formatDay(first.day, locale)}</span>
        <span>{t("netWorth.now")}</span>
      </div>
    </div>
  );
}
