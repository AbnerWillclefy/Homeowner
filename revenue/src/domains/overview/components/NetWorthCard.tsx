import { Badge, Card, ChartContainer, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, YAxis } from "recharts";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { NetWorth } from "../../net-worth/api";
import { percentText } from "../logic/format";
import { formatDay, monthName } from "../logic/month";
import { netWorthChange } from "../logic/netWorth";
import { CardHead } from "./CardHead";

/**
 * Today's Net worth, and this month's change of balances plus Investments (the line is that same basis, never the Net worth itself).
 * The sparkline has no axes or tooltip, so it shows no money; its table is for screen readers. A past month shows no change: the read is today's.
 */
export function NetWorthCard({ data, month, current }: { data: NetWorth; month: string; current: boolean }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const change = current ? netWorthChange(data) : null;
  const up = (change?.percent ?? 0) >= 0;
  return (
    <Card>
      <CardHead label={t("nav.netWorth")} to="/net-worth" name={t("nav.netWorth")} />
      {data.today === null ? (
        <p className="text-text-muted">{t("netWorth.empty.title")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Amount cents={data.today.totalCents} size="md" locale={locale} {...hidden} />
            {change?.percent != null && (
              <Badge tone={up ? "positive" : "warning"} icon={up ? TrendingUp : TrendingDown}>{percentText(change.percent, locale)}</Badge>
            )}
          </div>
          {data.series.length > 1 && (
            <ChartContainer
              label={t("overview.netWorth.chart")}
              className="h-16"
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
                    {data.series.map((p) => (
                      <TableRow key={p.day}>
                        <TableCell>{formatDay(p.day, locale)}</TableCell>
                        <TableCell align="end"><Amount cents={p.cents} size="sm" locale={locale} {...hidden} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            >
              <AreaChart accessibilityLayer={false} data={data.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <YAxis hide domain={["auto", "auto"]} />
                <Area dataKey="cents" type="monotone" stroke="var(--brand)" strokeWidth={2} fill="var(--brand)" fillOpacity={0.12} dot={false} activeDot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          )}
          {change && (
            <span className="body inline-flex flex-wrap items-baseline gap-x-2 text-text-muted">
              <Amount cents={change.cents} size="sm" income locale={locale} {...hidden} />{" "}
              {t("overview.netWorth.in", { month: monthName(month, locale).toLocaleLowerCase(locale) })}
            </span>
          )}
        </>
      )}
    </Card>
  );
}
