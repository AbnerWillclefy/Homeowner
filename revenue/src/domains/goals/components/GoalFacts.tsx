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
  return (
    <dl className="flex flex-col gap-2 border-t border-border pt-4">
      {monthCents !== null && when.kind !== "reached" && (
        <Fact label={t("goals.card.month")}>
          <Amount cents={monthCents} size="sm" locale={locale} {...hide} />
        </Fact>
      )}
      <Fact label={t("goals.card.eta")}>
        <span className="flex flex-wrap items-center justify-end gap-2">
          <span className="body">{eta}</span>
          {badge}
        </span>
      </Fact>
      <Fact label={t("goals.card.where")}>
        <span className="body text-right [overflow-wrap:anywhere]">{where.length > 0 ? where.join(", ") : t("goals.card.whereNone")}</span>
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="body text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
