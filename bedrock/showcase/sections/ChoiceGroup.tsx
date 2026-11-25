import { useState } from "react";
import { Choice, ChoiceGroup } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "ChoiceGroup", question: "Como está sua energia hoje?", low: "Baixa", lowHint: "Só o essencial", mid: "Média", high: "Alta", off: "Indisponível" },
  en: { name: "ChoiceGroup", question: "How is your energy today?", low: "Low", lowHint: "Only the essentials", mid: "Medium", high: "High", off: "Unavailable" },
};

export default function ChoiceGroupSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [value, setValue] = useState<string | undefined>("mid");
  return (
    <Section name={t.name}>
      <ChoiceGroup label={t.question} value={value} onValueChange={setValue} className="max-w-sm">
        <Choice value="low" label={t.low} hint={t.lowHint} />
        <Choice value="mid" label={t.mid} />
        <Choice value="high" label={t.high} />
        <Choice value="off" label={t.off} disabled />
      </ChoiceGroup>
    </Section>
  );
}
