import { Badge, Card, CardContent, CardLabel, EmptyState, SegmentedControl, Skeleton } from "@homeowner/bedrock";
import { Amount, formatAmount, ListRow } from "@homeowner/bedrock/finance";
import { CreditCard, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { HideValuesToggle, useHiddenProps, useHideValues } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { percentText } from "../overview/logic/format";
import { NetWorthLine } from "./components/NetWorthLine";
import { useNetWorth } from "./hooks/useNetWorth";
import { useRowNames } from "./hooks/useRowNames";
import { partWidths, seriesChange } from "./logic/parts";
import { RANGES, rangeFromParam, startsLate } from "./logic/range";

/** "Patrimônio" at `/net-worth` (`?range=30d|90d|1y`): today's Net worth, balances plus Investments over time (which leave out the card bills), where it comes from and how the number is made. */
export function NetWorthPage() {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const [params, setParams] = useSearchParams();
  const range = rangeFromParam(params.get("range"));
  const { data, loading, failed, reload } = useNetWorth(range);
  const names = useRowNames();
  const today = data?.today;
  const money = (cents: number, income = false) => (hidden ? t("hide.label") : formatAmount(cents, { locale, income }));
  const change = data ? seriesChange(data.series) : null;
  const up = (change?.cents ?? 0) >= 0;
  const changeText = change && [...(hidden ? [] : [money(change.cents, true)]), ...(change.percent === null ? [] : [percentText(change.percent, locale)])].join(" · ");
  const withNames = (count: string | null | undefined, list: string[] | undefined) => [count, list?.join(", ")].filter(Boolean).join(" · ") || undefined;
  const monthBadge = (cents: number | undefined) =>
    cents === undefined ? undefined : <Badge tone={cents >= 0 ? "positive" : "warning"}>{t("netWorth.monthDelta", { amount: money(cents, true) })}</Badge>;

  const row = (to: string, icon: ReactNode, title: string, subtitle: string | undefined, cents: number, end: ReactNode) => (
    <li key={to}>
      <ListRow asChild leading={icon} title={title} subtitle={subtitle} cents={cents} end={end} locale={locale} {...hiddenProps}>
        <Link to={to} />
      </ListRow>
    </li>
  );
  const icon = (Icon: typeof Landmark, tone: string) => (
    <span aria-hidden className={`inline-flex size-8 items-center justify-center rounded-md ${tone}`}><Icon className="size-4" /></span>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.netWorth")} subtitle={t("netWorth.intro")} tools={<HideValuesToggle />} />

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("netWorth.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Landmark} kind="no-results" title={t("netWorth.error.title")} message={t("netWorth.error.message")} action={{ label: t("netWorth.error.retry"), onClick: reload }} />
      ) : !today || data.series.length === 0 ? (
        <EmptyState icon={Landmark} title={t("netWorth.empty.title")} message={t("netWorth.empty.message")} />
      ) : (
        <div className="grid gap-6 desktop:grid-cols-12">
          <Card className="desktop:col-span-12">
            <CardContent className="gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardLabel>{t("netWorth.today")}</CardLabel>
                  <Amount cents={today.totalCents} size="hero" locale={locale} {...hiddenProps} />
                  <span className="body text-text-muted">{startsLate(data.series, range) ? t("netWorth.startsAt") : t(`netWorth.note.${range}`)}</span>
                </div>
                <SegmentedControl
                  label={t("netWorth.range")}
                  value={range}
                  onValueChange={(next) => setParams(next === "30d" ? {} : { range: next }, { replace: true })}
                  options={RANGES.map((r) => ({ value: r, label: t(`netWorth.range.${r}`) }))}
                />
              </div>
              {changeText && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge tone={up ? "positive" : "warning"} icon={up ? TrendingUp : TrendingDown}>{changeText}</Badge>
                  <span className="caption text-text-muted">{t("netWorth.line")}</span>
                </div>
              )}
              <NetWorthLine series={data.series} />
              <p className="caption text-text-muted">{t("netWorth.gap", { amount: money(today.cardBillsCents) })}</p>
            </CardContent>
          </Card>

          <Card className="desktop:col-span-8" role="region" aria-labelledby="net-worth-from">
            <CardContent className="gap-4">
              <CardLabel id="net-worth-from">{t("netWorth.from")}</CardLabel>
              <div
                role="img"
                className="flex h-4 gap-1"
                aria-label={t("netWorth.barLabel", { investments: money(today.investmentsCents), accounts: money(today.balancesCents), bills: money(-today.cardBillsCents) })}
              >
                {partWidths(today).map((w, i) => (
                  <div key={i} className={`h-full rounded-sm ${["bg-brand", "bg-cat-transport", "bg-danger"][i]}`} style={{ width: `${w}%` }} />
                ))}
              </div>
              <ul className="divide-y divide-border">
                {row("/goals", icon(TrendingUp, "bg-brand-soft text-brand"), t("netWorth.investments"), withNames(names.investments && t(names.investments.length === 1 ? "netWorth.count.one" : "netWorth.count.many", { count: names.investments.length }), names.investments), today.investmentsCents, monthBadge(data.monthChange?.investmentsCents))}
                {row("/sources", icon(Landmark, "bg-cat-transport-soft text-cat-transport"), t("netWorth.accounts"), withNames(null, names.accounts), today.balancesCents, monthBadge(data.monthChange?.balancesCents))}
                {row("/card-bills", icon(CreditCard, "bg-danger-soft text-danger"), t("netWorth.openBills"), withNames(null, names.cards), -today.cardBillsCents, undefined)}
              </ul>
            </CardContent>
          </Card>

          <Card className="desktop:col-span-4" role="region" aria-labelledby="net-worth-how">
            <CardContent className="gap-3">
              <CardLabel id="net-worth-how">{t("netWorth.how")}</CardLabel>
              {([
                ["netWorth.balances", today.balancesCents],
                ["netWorth.plusInvestments", today.investmentsCents],
                ["netWorth.cardBills", today.cardBillsCents],
              ] as const).map(([key, cents]) => (
                <div key={key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span>{t(key)}</span>
                  <Amount cents={cents} size="sm" locale={locale} {...hiddenProps} />
                </div>
              ))}
              <hr className="border-border" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <strong>{t("netWorth.total")}</strong>
                <Amount cents={today.totalCents} size="md" locale={locale} {...hiddenProps} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
