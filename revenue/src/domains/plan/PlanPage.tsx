import { useI18n } from "../../shared/i18n/I18nProvider";
import { MenuCard, MenuRow } from "../../shared/MenuList";
import { PageHeader } from "../../shared/PageHeader";
import type { Screen } from "../../app/screens";
import { usePlanRows } from "./hooks/usePlanRows";

/** "Planejar" at `/plan`, a phone screen: the planning screens as rows, each with a line of where it stands. Not in the Sidebar. */
export function PlanPage({ rows }: { rows: Screen[] }) {
  const { t } = useI18n();
  const details = usePlanRows();
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.plan")} subtitle={t("plan.subtitle")} hideValues />
      <MenuCard>
        {rows.map((s) => (
          <MenuRow key={s.path} to={s.path} icon={s.icon} title={t(s.label)} {...details[s.path]} />
        ))}
      </MenuCard>
    </section>
  );
}
