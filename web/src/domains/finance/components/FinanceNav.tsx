import { NavLink, useLocation } from "react-router";
import { FINANCES_BILLS_PATH, FINANCES_PATH, FINANCES_SAVINGS_PATH, FINANCES_SPENDING_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";

export const VIEWS = { summary: FINANCES_PATH, spending: FINANCES_SPENDING_PATH, bills: FINANCES_BILLS_PATH, savings: FINANCES_SAVINGS_PATH } as const;
export type FinanceView = keyof typeof VIEWS;

/** Resumo, Gastos, Contas and Economias as links, one route each, so a reload stays on the view. The picked month goes along. */
export function FinanceNav() {
  const { t } = useI18n();
  const { search } = useLocation();
  return (
    // Whole links wrap to a second row at the largest text; a label never breaks inside a word.
    <nav aria-label={t("finances.title")} className="flex flex-wrap gap-1 rounded-card border border-border bg-surface-raised p-1">
      {(Object.keys(VIEWS) as FinanceView[]).map((v) => (
        <NavLink
          key={v}
          to={{ pathname: VIEWS[v], search }}
          end
          className={({ isActive }) =>
            `inline-flex min-h-11 grow basis-auto items-center justify-center rounded-pill px-3 py-1 font-semibold no-underline motion-safe:transition-colors motion-safe:duration-150 ${
              isActive ? "bg-accent text-accent-contrast" : "text-muted"
            }`
          }
        >
          {t(`finances.view.${v}`)}
        </NavLink>
      ))}
    </nav>
  );
}
