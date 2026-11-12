import { Card, CardLabel } from "../../src";
import { DonutChart, formatAmount, type SpendingCategoryId } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "DonutChart",
    category: "Categoria",
    spent: "Gasto",
    total: "Total",
    other: "Outros",
    label: "Moradia leva 41% dos gastos",
    emptyLabel: "Nada gasto neste mês",
    many: "Nove categorias: as seis maiores e Outros",
    none: "Sem gastos",
    names: { housing: "Moradia", groceries: "Mercado", transport: "Transporte", "eating-out": "Restaurantes", health: "Saúde", leisure: "Lazer", shopping: "Compras", pets: "Pets", education: "Educação" },
  },
  en: {
    name: "DonutChart",
    category: "Category",
    spent: "Spent",
    total: "Total",
    other: "Other",
    label: "Housing takes 41% of spending",
    emptyLabel: "Nothing spent this month",
    many: "Nine categories: the top six and Other",
    none: "Nothing spent",
    names: { housing: "Housing", groceries: "Groceries", transport: "Transport", "eating-out": "Eating out", health: "Health", leisure: "Leisure", shopping: "Shopping", pets: "Pets", education: "Education" },
  },
};

const amounts: [SpendingCategoryId & keyof (typeof strings)["en"]["names"], number][] = [
  ["housing", 410000], ["groceries", 220000], ["transport", 120000], ["eating-out", 90000], ["health", 60000],
  ["leisure", 40000], ["shopping", 30000], ["pets", 20000], ["education", 10000],
];

function Table({ locale, rows }: { locale: Locale; rows: { label: string; cents: number }[] }) {
  const t = strings[locale];
  return (
    <table>
      <caption>{t.spent}</caption>
      <thead>
        <tr>
          <th scope="col">{t.category}</th>
          <th scope="col">{t.spent}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>{formatAmount(r.cents, { locale })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DonutChartSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const slices = amounts.map(([category, cents]) => ({ category, label: t.names[category], cents }));
  const few = slices.slice(0, 5);
  return (
    <Section name={t.name}>
      <Card>
        <CardLabel>{t.many}</CardLabel>
        <DonutChart slices={slices} otherLabel={t.other} label={t.label} totalLabel={t.total} locale={locale} alternative={<Table locale={locale} rows={slices} />} />
      </Card>
      <Card>
        <CardLabel>{t.none}</CardLabel>
        <DonutChart slices={[]} otherLabel={t.other} label={t.emptyLabel} locale={locale} alternative={<Table locale={locale} rows={[]} />} />
      </Card>
      <Card>
        <CardLabel>5</CardLabel>
        <DonutChart slices={few} otherLabel={t.other} label={t.label} totalLabel={t.total} locale={locale} alternative={<Table locale={locale} rows={few} />} />
      </Card>
    </Section>
  );
}
