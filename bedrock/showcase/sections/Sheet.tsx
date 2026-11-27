import { useState } from "react";
import { Flame } from "lucide-react";
import { Button, Menu, Sheet } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Sheet", open: "Abrir filtros", title: "Filtros", subtitle: "Escolha o que aparece na lista.", close: "Fechar", body: "Os filtros escolhidos valem para todas as contas.", apply: "Aplicar", full: "Abrir em tela alta", more: "Mais ações", leading: "Com ícone e menu", locked: "Abrir sem fechar", lockedTitle: "Salvando…", lockedBody: "Sem ✕, sem Escape e sem arrastar enquanto grava.", save: "Salvar", item: "Editar" },
  en: { name: "Sheet", open: "Open filters", title: "Filters", subtitle: "Choose what shows in the list.", close: "Close", body: "The chosen filters apply to every account.", apply: "Apply", full: "Open tall", more: "More actions", leading: "With icon and menu", locked: "Open without close", lockedTitle: "Saving…", lockedBody: "No ✕, no Escape and no drag while it writes.", save: "Save", item: "Edit" },
};

export default function SheetSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [open, setOpen] = useState(false);
  const [rich, setRich] = useState(false);
  const [tall, setTall] = useState(false);
  const [locked, setLocked] = useState(false);
  return (
    <Section name={t.name}>
      <div>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          trigger={<Button variant="secondary">{t.open}</Button>}
          title={t.title}
          subtitle={t.subtitle}
          closeLabel={t.close}
          footer={
            <Button size="lg" onClick={() => setOpen(false)}>
              {t.apply}
            </Button>
          }
        >
          <p className="body">{t.body}</p>
        </Sheet>
      </div>
      <div className="flex flex-wrap gap-2">
        <Sheet
          open={rich}
          onOpenChange={setRich}
          trigger={<Button variant="secondary">{t.leading}</Button>}
          title={t.title}
          subtitle={t.subtitle}
          closeLabel={t.close}
          leading={<Flame className="size-10 text-warning" aria-hidden />}
          tools={<Menu label={t.more} closeLabel={t.close} items={[{ label: t.item, onSelect: () => {} }]} />}
        >
          <p className="body">{t.body}</p>
        </Sheet>
        <Sheet open={tall} onOpenChange={setTall} trigger={<Button variant="secondary">{t.full}</Button>} title={t.title} closeLabel={t.close} size="full">
          <p className="body">{t.body}</p>
        </Sheet>
        <Sheet
          open={locked}
          onOpenChange={setLocked}
          trigger={<Button variant="secondary">{t.locked}</Button>}
          title={t.lockedTitle}
          closeLabel={t.close}
          dismissible={false}
          closeButton={false}
          footer={<Button size="lg" onClick={() => setLocked(false)}>{t.save}</Button>}
        >
          <p className="body">{t.lockedBody}</p>
        </Sheet>
      </div>
    </Section>
  );
}
