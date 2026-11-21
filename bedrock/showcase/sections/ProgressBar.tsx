import { ProgressBar } from "../../src";
import { Section } from "../Section";
import type { Locale } from "../App";

const text = {
  "pt-BR": { name: "Limite de gastos", of: "de", over: "R$ 200 acima" },
  en: { name: "Spending limit", of: "of", over: "R$ 200 over" },
};

export default function ProgressBarSection({ locale }: { locale: Locale }) {
  const t = text[locale];
  return (
    <Section name="ProgressBar">
      <div className="flex max-w-md flex-col gap-6">
        <ProgressBar label={t.name} value={1200} max={2000} valueText={`R$ 1.200 ${t.of} R$ 2.000`} start="R$ 1.200" end="R$ 2.000" />
        <ProgressBar label={t.name} value={1800} max={2000} valueText={`R$ 1.800 ${t.of} R$ 2.000`} start="R$ 1.800" end="R$ 2.000" />
        <ProgressBar label={t.name} value={2200} max={2000} valueText={`R$ 2.200 ${t.of} R$ 2.000, ${t.over}`} start={t.over} end="R$ 2.000" />
      </div>
    </Section>
  );
}
