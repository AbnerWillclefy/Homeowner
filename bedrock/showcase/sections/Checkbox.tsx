import { useState } from "react";
import { Checkbox } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Checkbox", rice: "Arroz 5 kg", beans: "Feijão", locked: "Café (já comprado)", hidden: "Leite, rótulo só para leitor de tela" },
  en: { name: "Checkbox", rice: "Rice 5 kg", beans: "Beans", locked: "Coffee (already bought)", hidden: "Milk, label for screen readers only" },
};

export default function CheckboxSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [rice, setRice] = useState(true);
  const [beans, setBeans] = useState(false);
  const [milk, setMilk] = useState(false);
  return (
    <Section name={t.name}>
      <div className="flex max-w-sm flex-col">
        <Checkbox label={t.rice} checked={rice} onCheckedChange={(v) => setRice(v === true)} />
        <Checkbox label={t.beans} checked={beans} onCheckedChange={(v) => setBeans(v === true)} />
        <Checkbox label={t.locked} checked disabled />
        <Checkbox label={t.hidden} hideLabel checked={milk} onCheckedChange={(v) => setMilk(v === true)} />
      </div>
    </Section>
  );
}
