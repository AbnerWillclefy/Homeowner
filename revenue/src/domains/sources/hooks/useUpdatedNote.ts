import { useI18n } from "../../../shared/i18n/I18nProvider";
import { timeAgo } from "../../../shared/timeAgo";
import { useSources } from "./useSources";

/** "Atualizado há 2 h", or "Importando…" while a bank imports; empty before the first read. The Sidebar and the More screen both show it. */
export function useUpdatedNote(now: Date) {
  const { t, locale } = useI18n();
  const sources = useSources().data;
  return sources?.importing ? t("sources.importing") : sources?.lastSyncedAt ? t("nav.updated", { when: timeAgo(sources.lastSyncedAt, now, locale) }) : undefined;
}
