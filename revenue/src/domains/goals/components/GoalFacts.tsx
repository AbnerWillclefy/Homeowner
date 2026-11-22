import { DescriptionList } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import type { ReactNode } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../logic/month";
import type { When } from "../logic/savings";

/** "Este mês", "Chega em" (with an optional status badge) and "Guardado em": the facts under a Goal's or the reserve's bar. A Goal behind its date says the same as any other, with no countdown or alarm. */
export function GoalFacts({ monthCents, when, badge, where }: { monthCents: number | null; when: When; badge?: ReactNode; where: string[] }) {
  const { t, locale } = useI18n();
  const hide = useHiddenProps();
  const eta =
    when.kind === "reached" ? t("goals.reached")
    : when.kind === "beyond" ? t("goals.beyond")
    : when.kind === "expected" ? monthLabel(when.month, locale)
    : "—";
  const items = [
    ...(monthCents !== null && when.kind !== "reached" ? [{ label: t("goals.card.month"), value: <Amount cents={monthCents} size="sm" locale={locale} {...hide} /> }] : []),
    { label: t("goals.card.eta"), value: <><span>{eta}</span>{badge}</> },
    { label: t("goals.card.where"), value: <span className="whitespace-normal [overflow-wrap:anywhere]">{where.length > 0 ? where.join(", ") : t("goals.card.whereNone")}</span> },
  ];
  return <DescriptionList items={items} className="grid-cols-[auto_minmax(0,1fr)] border-t border-border pt-4" />;
}
