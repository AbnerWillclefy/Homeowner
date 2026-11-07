import { useI18n } from "../../../shared/i18n";
import { PageHeader } from "../../../shared/ui/PageHeader";

/** Finances: private to the User, with no link to Residents, Chores, Tasks or Allocation. Empty until banks are connected. */
export function FinancesTab() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("finances.title")} />
      <p>{t("finances.empty")}</p>
    </>
  );
}
