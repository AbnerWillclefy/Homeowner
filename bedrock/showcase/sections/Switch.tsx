import { useState } from "react";
import { Switch } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Switch", reminder: "Lembrar 3 dias antes do vencimento", hide: "Ocultar valores", locked: "Sincronizar com o banco" },
  en: { name: "Switch", reminder: "Remind 3 days before the due date", hide: "Hide amounts", locked: "Sync with the bank" },
};

export default function SwitchSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [reminder, setReminder] = useState(true);
  const [hide, setHide] = useState(false);
  return (
    <Section name={t.name}>
      <div className="flex max-w-sm flex-col">
        <Switch label={t.reminder} checked={reminder} onCheckedChange={setReminder} />
        <Switch label={t.hide} checked={hide} onCheckedChange={setHide} />
        <Switch label={t.locked} checked disabled />
      </div>
    </Section>
  );
}
