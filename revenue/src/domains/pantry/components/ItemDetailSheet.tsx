import { Badge, Banner, Button, Card, CardContent, CardLabel, ChartContainer, ChartTooltipContent, EmptyState, Sheet, Skeleton } from "@homeowner/bedrock";
import { formatAmount, StatCard } from "@homeowner/bedrock/finance";
import { Clock, Receipt, RefreshCw, Repeat } from "lucide-react";
import { useEffect } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { PantryItem } from "../api";
import { useItem } from "../hooks/useItem";
import { daysCopy, detailView, type PricePoint } from "../logic/itemDetail";

interface Props {
  item: PantryItem;
  onRanOut(item: PantryItem): void;
  onClose(): void;
  /** The item is gone (404): the Pantry reads again. */
  onGone(): void;
}

/**
 * What an item costs and how fast it goes: average duration, last price with store and date, and the price history.
 * The head comes from the Pantry row, so it shows at once; the rest is read when the Sheet opens.
 * A forecast has no data behind it yet, so its place holds static copy.
 */
export function ItemDetailSheet({ item, onRanOut, onClose, onGone }: Props) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const query = useItem(item.id);
  const read = query.data;
  const gone = read?.kind === "not-found";
  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  const view = read?.kind === "ok" ? detailView(read.detail) : null;

  const chart = (v: { points: PricePoint[]; last: PricePoint; lowest: PricePoint }) =>
    v.points.length === 1 ? (
      <p className="body text-text-muted">{t("pantry.item.oneBuy")}</p>
    ) : (
      <ChartContainer
        label={t("pantry.item.chartLabel", { name: item.name, last: money(v.last.cents), lowest: money(v.lowest.cents) })}
        className="h-48"
        alternative={<p>{t("pantry.item.chartText", { last: money(v.last.cents), lastDay: formatDay(v.last.day, locale), lowest: money(v.lowest.cents), lowestDay: formatDay(v.lowest.day, locale) })}</p>}
      >
        <LineChart accessibilityLayer={false} data={v.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} tickFormatter={(d: string) => formatDay(d, locale)} />
          <YAxis orientation="right" hide={hidden} tickCount={3} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(c: number) => formatAmount(c, { locale, precision: "whole" })} />
          <Line dataKey="cents" type="monotone" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand)", stroke: "var(--brand)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Tooltip content={<ChartTooltipContent formatValue={money} />} labelFormatter={(d) => formatDay(String(d), locale)} />
        </LineChart>
      </ChartContainer>
    );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.name}
      subtitle={item.preferredBrand ?? undefined}
      closeLabel={t("app.close")}
      footer={item.state === "in_stock" && view?.kind === "ready" ? <Button variant="secondary" size="lg" onClick={() => onRanOut(item)}>{t("pantry.ranOut")}</Button> : undefined}
    >
      <div className="flex flex-col gap-4">
        {item.fixed && <Badge tone="brand" icon={Repeat} className="self-start">{t("pantry.always")}</Badge>}
        {query.isPending || gone ? (
          <div aria-busy="true" aria-label={t("pantry.item.loading")} className="flex flex-col gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !view ? (
          <Banner tone="danger" action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => void query.refetch()}>{t("pantry.error.retry")}</Button>}>
            {t("pantry.item.error")}
          </Banner>
        ) : view.kind === "empty" ? (
          <EmptyState icon={Receipt} title={t("pantry.item.emptyTitle")} message={t("pantry.item.emptyText")} />
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4">
              <Card variant="compact">
                <CardLabel>{t("pantry.item.avg")}</CardLabel>
                <CardContent>
                  {view.avgDays !== null ? (
                    <p className="section-title">{t(daysCopy(view.avgDays).key, { count: view.avgDays })}</p>
                  ) : (
                    <p className="caption text-text-muted">{t("pantry.item.noCycle")}</p>
                  )}
                </CardContent>
              </Card>
              <StatCard
                {...hiddenProps}
                label={t("pantry.item.lastPrice")}
                cents={view.last.cents}
                locale={locale}
                hint={t("pantry.item.lastWhere", { store: view.last.store, date: formatDay(view.last.day, locale) })}
              />
            </div>
            <h3 className="body-strong">{t("pantry.item.history")}</h3>
            {chart(view)}
          </>
        )}
        <Banner icon={Clock}>
          <strong>{t("pantry.item.forecast")}</strong> · {t("pantry.item.soon")}
        </Banner>
      </div>
    </Sheet>
  );
}
