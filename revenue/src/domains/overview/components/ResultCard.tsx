import { Badge, Card, DescriptionList } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { HistoryMonth } from "../api/api";
import { percentText, shortMonth } from "../logic/format";
import { addMonths } from "../logic/month";
import { resultChange, resultCents } from "../logic/result";
import { CardHead } from "./CardHead";

const EMPTY = { incomeCents: 0, spentCents: 0, savedCents: 0 };

/** The month's result and what it is made of, with its change against the whole month before. */
export function ResultCard({ history, month, current }: { history: HistoryMonth[]; month: string; current: boolean }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const previousMonth = addMonths(month, -1);
  const now = history.find((m) => m.month === month) ?? { month, ...EMPTY };
  const change = resultChange(now, history.find((m) => m.month === previousMonth));
  const parts = [
    { key: "overview.result.income", cents: now.incomeCents },
    { key: "overview.result.spent", cents: now.spentCents },
    { key: "overview.result.saved", cents: now.savedCents },
  ] as const;
  return (
    <Card>
      <CardHead label={t("overview.result.heading")} to="/projection" name={t("nav.projection")} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <Amount cents={resultCents(now)} size="lg" locale={locale} {...hidden} />
        {current && <span className="body text-text-muted">{t("overview.result.untilToday")}</span>}
        {change !== null && (
          <Badge tone={change >= 0 ? "positive" : "warning"} icon={change >= 0 ? TrendingUp : TrendingDown}>
            {t("overview.result.vs", { percent: percentText(change, locale), month: shortMonth(previousMonth, locale) })}
          </Badge>
        )}
      </div>
      <DescriptionList
        items={parts.map((p) => ({
          label: t(p.key),
          value: <Amount cents={p.cents} size="sm" locale={locale} {...hidden} />,
        }))}
      />
    </Card>
  );
}
