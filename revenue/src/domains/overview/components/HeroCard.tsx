import { Badge, Button, Card } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { Check, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CommitmentMonth } from "../api/api";
import { heroView } from "../logic/hero";
import { daysInMonth, formatDay } from "../logic/month";
import { PaceView } from "./PaceView";

/** What is left to spend this month and how the spending runs against the straight line; without a Monthly income, an invitation to set one. */
export function HeroCard({ data, income, month }: { data: CommitmentMonth; income: number | null; month: string }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const days = daysInMonth(month);
  const view = heroView(data, income, days);
  if (view.kind === "none") return null;
  if (view.kind === "invite") {
    return (
      <Card className="items-start">
        <p>{t("overview.income.invite")}</p>
        <Button asChild variant="secondary">
          <Link to="/settings">{t("overview.income.set")}</Link>
        </Button>
      </Card>
    );
  }
  const left = view.kind === "left";
  return (
    <Card variant="hero" aria-labelledby="overview-hero">
      <div className="flex items-center justify-between gap-2">
        <h2 id="overview-hero" className="card-label">{t(left ? "overview.hero.label" : "overview.hero.labelPast")}</h2>
        {left && view.onPace !== null && (
          <Badge tone={view.onPace ? "solid" : "warning"} icon={view.onPace ? Check : TriangleAlert}>
            {t(view.onPace ? "overview.hero.onPace" : "overview.hero.offPace")}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {left ? <Amount cents={view.cents} size="hero" locale={locale} {...hidden} /> : <Amount cents={view.spentCents} reference={view.lineEndCents} size="hero" locale={locale} {...hidden} />}
        {left && (
          <span className="body inline-flex flex-wrap items-baseline gap-x-2 text-text-muted">
            <Amount cents={view.perDayCents} size="sm" locale={locale} {...hidden} />{" "}
            {t("overview.hero.perDay", { date: formatDay(`${month}-${String(days).padStart(2, "0")}`, locale) })}
          </span>
        )}
        {left && view.cents < 0 && <p className="caption text-text-muted">{t("overview.allowance.hintNegative")}</p>}
      </div>
      {data.pace && <PaceView pace={data.pace} month={month} />}
      {left && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 tabular-nums">
          <span className="body text-text-muted">{t("overview.hero.spent")}</span>
          <Amount cents={view.spentCents} reference={view.lineEndCents} size="sm" locale={locale} {...hidden} />
        </div>
      )}
    </Card>
  );
}
