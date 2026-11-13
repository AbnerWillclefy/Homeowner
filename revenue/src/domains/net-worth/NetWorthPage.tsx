import { Card, CardContent, CardLabel, EmptyState, Banner, SegmentedControl, Skeleton } from "@homeowner/bedrock";
import { Amount, formatAmount, StatCard } from "@homeowner/bedrock/finance";
import { Landmark } from "lucide-react";
import { useSearchParams } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { NetWorthLine } from "./components/NetWorthLine";
import { useNetWorth } from "./hooks/useNetWorth";
import { RANGES, rangeFromParam, startsLate } from "./logic/range";

/** "Patrimônio" at `/net-worth` (`?range=30d|90d|1y`): today's Net worth with its parts, and balances plus Investments over time, which leave out the card bills. */
export function NetWorthPage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const range = rangeFromParam(params.get("range"));
  const { data, loading, failed, reload } = useNetWorth(range);
  const today = data?.today;
  const last = data?.series.at(-1);
  const hasLine = !!data && last !== undefined;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.netWorth")}</h1>
      <p className="text-text-muted">{t("netWorth.intro")}</p>

        <SegmentedControl
          label={t("netWorth.range")}
          block
          value={range}
          onValueChange={(next) => setParams(next === "30d" ? {} : { range: next }, { replace: true })}
          options={RANGES.map((r) => ({ value: r, label: t(`netWorth.range.${r}`) }))}
        />

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("netWorth.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Landmark} kind="no-results" title={t("netWorth.error.title")} message={t("netWorth.error.message")} action={{ label: t("netWorth.error.retry"), onClick: reload }} />
      ) : (
        <>
          {today && (
            <div className="grid gap-4 desktop:grid-cols-2">
              <StatCard label={t("netWorth.today")} cents={today.totalCents} size="hero" locale={locale} />
              <Card>
                <CardLabel id="net-worth-parts">{t("netWorth.parts")}</CardLabel>
                <CardContent>
                  <ul aria-labelledby="net-worth-parts" className="flex flex-col gap-3">
                    {([
                      ["netWorth.balances", today.balancesCents],
                      ["netWorth.investments", today.investmentsCents],
                      ["netWorth.cardBills", today.cardBillsCents],
                    ] as const).map(([key, cents]) => (
                      <li key={key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-text-muted">{t(key)}</span>
                        <Amount cents={cents} size="lg" locale={locale} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          <section aria-labelledby="net-worth-line" className="flex flex-col gap-3">
            <h2 id="net-worth-line" className="section-title">{t("netWorth.line")}</h2>
            {hasLine ? (
              <>
                <NetWorthLine series={data.series} />
                {today && <p className="caption text-text-muted">{t("netWorth.gap", { amount: formatAmount(today.cardBillsCents, { locale }) })}</p>}
                {startsLate(data.series, range) && <Banner tone="neutral">{t("netWorth.startsAt")}</Banner>}
              </>
            ) : (
              <EmptyState icon={Landmark} title={t("netWorth.empty.title")} message={t("netWorth.empty.message")} />
            )}
          </section>
        </>
      )}
    </section>
  );
}
