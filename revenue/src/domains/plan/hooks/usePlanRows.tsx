import type { ReactNode } from "react";
import { Badge } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMonthParam } from "../../../shared/month/useMonthParam";
import { useMoney } from "../../goals/hooks/useMoney";
import { useSavings } from "../../goals/hooks/useSavings";
import { useNetWorth } from "../../net-worth/hooks/useNetWorth";
import { netWorthChange } from "../../overview/logic/netWorth";
import { monthName } from "../../overview/logic/month";
import { useProjection } from "../../projection/hooks/useProjection";
import { useSources } from "../../sources/hooks/useSources";
import { firstReconnect, firstShortMonth, goalsProgress } from "../logic/plan";

export interface RowDetail {
  caption?: string;
  end?: ReactNode;
}

/**
 * What each Planejar row shows beside its title, by the screen's path. Each read shares its query key with its screen,
 * so a row costs no request of its own; while one is loading or failed its row shows only the title. Captions that carry
 * money are left out while values are hidden: a formatted string does not follow the toggle.
 */
export function usePlanRows(): Record<string, RowDetail> {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const money = useMoney();
  const { thisMonth } = useMonthParam();
  const savings = useSavings().data;
  const netWorth = useNetWorth("30d").data;
  const projection = useProjection().data;
  const sources = useSources().data;

  const rows: Record<string, RowDetail> = {};

  if (savings) {
    const progress = goalsProgress(savings.goals);
    rows["/goals"] = {
      caption: savings.contributionBaseCents && !hidden ? t("plan.goals.caption", { amount: money(savings.contributionBaseCents) }) : undefined,
      end: progress === null ? undefined : <span className="body-strong tabular-nums">{new Intl.NumberFormat(locale, { style: "percent" }).format(progress)}</span>,
    };
  }

  if (netWorth?.today) {
    const change = netWorthChange(netWorth);
    const when = t("overview.netWorth.in", { month: monthName(thisMonth, locale).toLocaleLowerCase(locale) });
    rows["/net-worth"] = {
      caption: change && !hidden ? `${change.cents > 0 ? "+" : ""}${money(change.cents)} ${when}` : undefined,
      end: <Amount cents={netWorth.today.totalCents} size="sm" locale={locale} {...hiddenProps} />,
    };
  }

  const short = projection && firstShortMonth(projection.months);
  if (short) {
    const month = monthName(short.month, locale);
    rows["/projection"] = {
      caption: hidden ? t("plan.projection.short.hidden", { month }) : t("plan.projection.short", { month, amount: money(-short.cents) }),
      end: <Badge tone="danger">{t("plan.projection.badge")}</Badge>,
    };
  }

  const reconnect = sources && firstReconnect(sources.items);
  if (reconnect) {
    rows["/sources"] = {
      caption: t("plan.sources.caption", { bank: reconnect.bankName ?? t("plan.sources.aBank") }),
      end: <Badge tone="warning">{t("sources.banks.reconnect")}</Badge>,
    };
  }

  return rows;
}
