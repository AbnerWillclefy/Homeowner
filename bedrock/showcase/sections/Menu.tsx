import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Menu } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Menu", hint: "Abaixo de 768px os itens abrem em uma folha.", label: "Mais ações", close: "Fechar", edit: "Editar", duplicate: "Duplicar", delete: "Excluir", last: "Última ação:", none: "nenhuma" },
  en: { name: "Menu", hint: "Below 768px the items open in a sheet.", label: "More actions", close: "Close", edit: "Edit", duplicate: "Duplicate", delete: "Delete", last: "Last action:", none: "none" },
};

export default function MenuSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [last, setLast] = useState<string>();
  return (
    <Section name={t.name}>
      <p className="caption text-text-muted">{t.hint}</p>
      <div className="flex items-center gap-4">
        <Menu
          label={t.label}
          closeLabel={t.close}
          items={[
            { label: t.delete, icon: Trash2, danger: true, onSelect: () => setLast(t.delete) },
            { label: t.edit, icon: Pencil, onSelect: () => setLast(t.edit) },
            { label: t.duplicate, icon: Copy, onSelect: () => setLast(t.duplicate) },
          ]}
        />
        <p className="body text-text-muted">
          {t.last} {last ?? t.none}
        </p>
      </div>
    </Section>
  );
}
