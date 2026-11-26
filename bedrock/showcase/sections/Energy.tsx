import { useState } from "react";
import { Choice, ChoiceGroup } from "../../src";
import { Energy, EnergyBars, type EnergyLevel } from "../../src/home";
import type { Locale } from "../App";
import { Section } from "../Section";

const levels: { level: EnergyLevel; name: Record<Locale, string>; hint: Record<Locale, string> }[] = [
  { level: 0, name: { "pt-BR": "Esgotado", en: "Drained" }, hint: { "pt-BR": "Sem tarefas hoje", en: "No tasks today" } },
  { level: 2, name: { "pt-BR": "Baixa", en: "Low" }, hint: { "pt-BR": "Só o leve", en: "Light tasks only" } },
  { level: 3, name: { "pt-BR": "Normal", en: "Normal" }, hint: { "pt-BR": "Um dia comum", en: "An ordinary day" } },
  { level: 4, name: { "pt-BR": "Energizado", en: "Energised" }, hint: { "pt-BR": "Pode vir mais", en: "Bring more" } },
];
const strings = {
  "pt-BR": { chip: "Energia", change: "Mudar", group: "Como está sua energia hoje?", hero: "No cartão de destaque" },
  en: { chip: "Energy", change: "Change", group: "How is your energy today?", hero: "On the hero card" },
};

export default function EnergySection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [value, setValue] = useState("3");
  return (
    <Section name="Energy">
      <ul className="flex flex-wrap gap-2">
        {levels.map(({ level, name }) => (
          <li key={level}>
            <Energy level={level} name={name[locale]} label={`${t.chip}: ${name[locale].toLowerCase()}. ${t.change}`} />
          </li>
        ))}
      </ul>
      <p className="caption text-text-muted">{t.hero}</p>
      <div className="rounded-lg bg-hero p-4 text-on-hero">
        <Energy onHero level={3} name={levels[2]!.name[locale]} label={`${t.chip}: ${levels[2]!.name[locale].toLowerCase()}. ${t.change}`} />
      </div>
      <ChoiceGroup label={t.group} value={value} onValueChange={setValue}>
        {levels.map(({ level, name, hint }) => (
          <Choice key={level} value={String(level)} label={name[locale]} hint={hint[locale]} leading={<EnergyBars level={level} />} />
        ))}
      </ChoiceGroup>
    </Section>
  );
}
