import { Effort } from "../../src/home";
import type { Locale } from "../App";
import { Section } from "../Section";

const levels = {
  "pt-BR": ["Muito leve", "Leve", "Médio", "Pesado", "Muito pesado"],
  en: ["Very light", "Light", "Medium", "Heavy", "Very heavy"],
};
const prefix = { "pt-BR": "Esforço", en: "Effort" };

export default function EffortSection({ locale }: { locale: Locale }) {
  return (
    <Section name="Effort">
      <ul className="flex flex-col gap-2">
        {levels[locale].map((name, i) => (
          <li key={name}>
            <Effort level={(i + 1) as 1 | 2 | 3 | 4 | 5} name={name} label={`${prefix[locale]}: ${name.toLowerCase()}`} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
