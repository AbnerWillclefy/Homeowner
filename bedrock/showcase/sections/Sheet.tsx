import { useState } from "react";
import { Button, Sheet } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Sheet", open: "Abrir filtros", title: "Filtros", subtitle: "Escolha o que aparece na lista.", close: "Fechar", body: "Os filtros escolhidos valem para todas as contas.", apply: "Aplicar" },
  en: { name: "Sheet", open: "Open filters", title: "Filters", subtitle: "Choose what shows in the list.", close: "Close", body: "The chosen filters apply to every account.", apply: "Apply" },
};

export default function SheetSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [open, setOpen] = useState(false);
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
    </Section>
  );
}
