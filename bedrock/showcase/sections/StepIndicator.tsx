import { StepIndicator } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "StepIndicator", one: "Passo 2 de 5", two: "Passo 5 de 5", base: "Energia base", last: "Pronto" },
  en: { name: "StepIndicator", one: "Step 2 of 5", two: "Step 5 of 5", base: "Base energy", last: "Done" },
};

export default function StepIndicatorSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <div className="flex max-w-sm flex-col gap-6">
        <StepIndicator label={t.one} current={2} total={5} name={t.base} />
        <StepIndicator label={t.two} current={5} total={5} name={t.last} />
      </div>
    </Section>
  );
}
