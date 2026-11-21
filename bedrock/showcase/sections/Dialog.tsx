import { useState } from "react";
import { Button, Dialog } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Dialog", open: "Excluir conta", title: "Excluir conta?", description: "Isso apaga seus dados e não dá para desfazer.", cancel: "Cancelar", confirm: "Excluir" },
  en: { name: "Dialog", open: "Delete account", title: "Delete account?", description: "This erases your data and cannot be undone.", cancel: "Cancel", confirm: "Delete" },
};

export default function DialogSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [open, setOpen] = useState(false);
  return (
    <Section name={t.name}>
      <div>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          trigger={<Button variant="secondary">{t.open}</Button>}
          title={t.title}
          description={t.description}
          cancelLabel={t.cancel}
          confirmLabel={t.confirm}
          onConfirm={() => setOpen(false)}
        />
      </div>
    </Section>
  );
}
