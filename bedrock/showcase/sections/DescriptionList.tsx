import { DescriptionList } from "../../src";
import { Amount } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "DescriptionList", income: "Entradas", bills: "− Faturas", restaurants: "− Restaurantes acima do plano", left: "Sobra do mês" },
  en: { name: "DescriptionList", income: "Income", bills: "− Card bills", restaurants: "− Restaurants over plan", left: "Left this month" },
};

export default function DescriptionListSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const amount = (cents: number) => <Amount cents={cents} size="sm" locale={locale} />;
  return (
    <Section name={t.name}>
      <div className="rounded-lg border border-border bg-surface p-4">
        <DescriptionList
          items={[
            { label: t.income, value: amount(500000) },
            { label: t.bills, value: amount(120000) },
            { label: t.restaurants, value: amount(32050) },
            { label: t.left, value: amount(347950), total: true },
          ]}
        />
      </div>
    </Section>
  );
}
