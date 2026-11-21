import { useI18n } from "../../shared/i18n/I18nProvider";
import { MenuCard, MenuRow } from "../../shared/MenuList";
import { PageHeader } from "../../shared/PageHeader";
import { useNow } from "../../shared/useNow";
import type { Screen } from "../../app/screens";
import { useUpdatedNote } from "../sources/hooks/useUpdatedNote";
import { useMoreRows } from "./hooks/useMoreRows";

const TONES: Record<string, "warning" | "groceries"> = { "/bills": "warning", "/categories": "groceries", "/pantry": "groceries" };

/** "Mais" at `/more`, a phone screen: the other screens as rows in two cards (Settings has its own), then when the banks were read. Not in the Sidebar. */
export function MorePage({ rows }: { rows: Screen[][] }) {
  const { t } = useI18n();
  const details = useMoreRows();
  const updated = useUpdatedNote(useNow());
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.more")} hideValues />
      {rows.map((card) => (
        <MenuCard key={card[0]!.path}>
          {card.map((s) => (
            <MenuRow key={s.path} to={s.path} icon={s.icon} title={t(s.label)} tone={TONES[s.path]} {...details[s.path]} />
          ))}
        </MenuCard>
      ))}
      {updated && <p className="caption text-center text-text-muted">{updated}</p>}
    </section>
  );
}
