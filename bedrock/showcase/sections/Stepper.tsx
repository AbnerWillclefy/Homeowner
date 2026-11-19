import { useState } from "react";
import { Stepper } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Stepper", units: "Quantidade de arroz", kg: "Peso do queijo", less: "Menos", more: "Mais", off: "Quantidade desativada" },
  en: { name: "Stepper", units: "Quantity of rice", kg: "Weight of cheese", less: "Less", more: "More", off: "Quantity disabled" },
};

export default function StepperSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [units, setUnits] = useState(2);
  const [kg, setKg] = useState(1.234);
  const kgFormat = (v: number) => `${v.toLocaleString(locale, { minimumFractionDigits: 3 })} kg`;
  return (
    <Section name={t.name}>
      <div className="flex flex-col items-start gap-4">
        <Stepper label={t.units} decrementLabel={t.less} incrementLabel={t.more} value={units} onValueChange={setUnits} />
        <Stepper label={t.kg} decrementLabel={t.less} incrementLabel={t.more} value={kg} onValueChange={setKg} step={0.001} format={kgFormat} />
        <Stepper label={t.off} decrementLabel={t.less} incrementLabel={t.more} value={3} onValueChange={() => {}} disabled />
      </div>
    </Section>
  );
}
