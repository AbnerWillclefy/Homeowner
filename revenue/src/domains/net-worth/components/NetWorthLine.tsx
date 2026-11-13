import { ChartContainer, ChartTooltipContent, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../bills/logic/month";
import type { NetWorthPoint } from "../api";

/** Balances plus Investments per day. Draws only the points it is given, so days before the first sync stay empty; the table holds every value. */
export function NetWorthLine({ series }: { series: NetWorthPoint[] }) {
  const { t, locale } = useI18n();
  const first = series[0]!;
  const last = series.at(-1)!;
  const money = (cents: number) => formatAmount(cents, { locale });
  const label = t("netWorth.lineLabel", { from: money(first.cents), fromDay: formatDay(first.day, locale), to: money(last.cents), toDay: formatDay(last.day, locale) });

  return (
    <ChartContainer
      label={label}
      className="h-56"
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
      <LineChart accessibilityLayer={false} data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={32} tickFormatter={(d: string) => formatDay(d, locale)} />
        <YAxis tickCount={4} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(c: number) => formatAmount(c, { locale, precision: "compact" })} />
        <Line dataKey="cents" type="monotone" stroke="var(--brand)" strokeWidth={2.5} dot={false} />
        <Tooltip content={<ChartTooltipContent formatValue={money} />} labelFormatter={(d) => formatDay(String(d), locale)} />
      </LineChart>
    </ChartContainer>
  );
}
