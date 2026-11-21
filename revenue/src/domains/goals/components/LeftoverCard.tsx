import { Badge, Card, CardHeader, CardLabel } from "@homeowner/bedrock";
import { TrendingUp } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Leftover } from "../api";
import { useMoney } from "../hooks/useMoney";

/** Sobrou neste mês: what the month's leftover could add. Only a suggestion: there is no one-off contribution to make, so there is no button. */
export function LeftoverCard({ leftover, className }: { leftover: Leftover; className?: string }) {
  const { t } = useI18n();
  const money = useMoney();
  const { monthsSooner } = leftover;
  return (
    <Card className={className}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardLabel>{t("goals.leftover.title")}</CardLabel>
        <Badge tone="positive" icon={TrendingUp}>{money(leftover.leftoverCents, "whole")}</Badge>
      </CardHeader>
      {leftover.extraCents > 0 && (
        <p className="body">
          {t("goals.leftover.extra", { amount: money(leftover.extraCents, "whole") })}
          {monthsSooner !== null && monthsSooner > 0 && ` ${t(monthsSooner === 1 ? "goals.leftover.sooner.one" : "goals.leftover.sooner.many", { count: monthsSooner })}`}
        </p>
      )}
    </Card>
  );
}
