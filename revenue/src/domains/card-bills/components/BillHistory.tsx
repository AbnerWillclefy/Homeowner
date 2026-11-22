import { Button, Card, CardLabel, ChartContainer, DescriptionList, Skeleton } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthShort } from "../../../shared/month/month";
import type { PastBills } from "../api";

interface Props {
  history: PastBills | undefined;
  loading: boolean;
  failed: boolean;
  reload(): void;
}

/**
 * "Últimas faturas": the closed bills as bars and their average. The chart prints no money (no axis, no tooltip),
 * so hiding values needs nothing more; the table for screen readers is made of Amounts that follow the toggle.
 */
export function BillHistory({ history, loading, failed, reload }: Props) {
  const { t, locale } = useI18n();
  const hiddenProps = useHiddenProps();
  const { hidden } = useHideValues();
  const bills = history?.bills ?? [];
  const data = bills.map((b) => ({ label: monthShort(b.closesOn.slice(0, 7), locale), cents: b.totalCents }));
  const first = data[0]?.label;
  const last = data.at(-1)?.label;
  const average = history?.averageCents ?? null;
  const label = first && last ? `${t("cardBills.history.label", { from: first, to: last })}${hidden || average === null ? "" : `, ${t("cardBills.history.average", { count: data.length })} ${formatAmount(average, { locale })}`}` : "";
  return (
    <Card>
      <CardLabel>{t("cardBills.history.title")}</CardLabel>
      {loading ? (
        <div role="status"><span className="sr-only">{t("cardBills.history.loading")}</span><Skeleton className="h-40 w-full" /></div>
      ) : failed || !history ? (
        <div className="flex flex-col items-start gap-2">
          <p className="caption text-text-muted">{t("cardBills.history.failed")}</p>
          <Button variant="secondary" onClick={reload}>{t("bills.error.retry")}</Button>
        </div>
      ) : data.length === 0 ? (
        <p className="caption text-text-muted">{t("cardBills.history.none")}</p>
      ) : (
        <>
          <ChartContainer
            label={label}
            alternative={
              <table>
                <tbody>
                  {bills.map((b, i) => (
                    <tr key={b.closesOn}><th>{data[i]!.label}</th><td><Amount cents={b.totalCents} size="sm" locale={locale} {...hiddenProps} /></td></tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <Bar dataKey="cents" fill="var(--chart-bar)" radius={[4, 4, 4, 4]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
          {average !== null && (
            <DescriptionList items={[{ label: t("cardBills.history.average", { count: data.length }), value: <Amount cents={average} size="sm" locale={locale} {...hiddenProps} /> }]} />
          )}
        </>
      )}
    </Card>
  );
}
