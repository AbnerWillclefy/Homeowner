import { EmptyState } from "@homeowner/bedrock";
import { Construction } from "lucide-react";
import { useI18n } from "./i18n/I18nProvider";
import type { MessageKey } from "./i18n/catalogs";

/** A screen whose content is not built yet. Each finance screen's own ticket replaces its use. */
export function ScreenPlaceholder({ titleKey }: { titleKey: MessageKey }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t(titleKey)}</h1>
      <EmptyState icon={Construction} title={t(titleKey)} message={t("page.soon")} />
    </section>
  );
}
