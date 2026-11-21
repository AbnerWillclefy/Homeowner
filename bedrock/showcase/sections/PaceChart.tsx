import { Card, CardLabel } from "../../src";
import { formatAmount, PaceChart } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "PaceChart",
    day: "Dia",
    spent: "Gasto",
    under: "R$ 200 abaixo do ritmo",
    underMarker: "R$ 200 abaixo",
    over: "R$ 200 acima do ritmo",
    overMarker: "R$ 200 acima",
    underCard: "Abaixo do ritmo, com eixos",
    overCard: "Acima do ritmo, com eixos",
    heroCard: "Cartão de destaque, sem eixos",
  },
  en: {
    name: "PaceChart",
    day: "Day",
    spent: "Spent",
    under: "R$ 200 under pace",
    underMarker: "R$ 200 under",
    over: "R$ 200 over pace",
    overMarker: "R$ 200 over",
    underCard: "Under pace, with axes",
    overCard: "Over pace, with axes",
    heroCard: "Hero card, no axes",
  },
};

const DAYS = 30;
const LIMIT = 300000;
// Cumulative spending to day 15: the pace line sits at 150000 there.
const spentTo = (total: number) => Array.from({ length: 15 }, (_, i) => ({ day: i + 1, cents: Math.round((total * (i + 1)) / 15) }));
const under = spentTo(130000);
const over = spentTo(170000);

function Table({ locale, rows }: { locale: Locale; rows: { day: number; cents: number }[] }) {
  const t = strings[locale];
  return (
    <table>
      <caption>{t.spent}</caption>
      <thead>
        <tr>
          <th scope="col">{t.day}</th>
          <th scope="col">{t.spent}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.day}>
            <td>{r.day}</td>
            <td>{formatAmount(r.cents, { locale })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PaceChartSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <Card>
        <CardLabel>{t.underCard}</CardLabel>
        <PaceChart axes days={DAYS} limitCents={LIMIT} spent={under} label={t.under} markerLabel={t.underMarker} locale={locale} alternative={<Table locale={locale} rows={under} />} />
      </Card>
      <Card>
        <CardLabel>{t.overCard}</CardLabel>
        <PaceChart axes days={DAYS} limitCents={LIMIT} spent={over} label={t.over} markerLabel={t.overMarker} locale={locale} alternative={<Table locale={locale} rows={over} />} />
      </Card>
      <Card variant="hero">
        <CardLabel>{t.heroCard}</CardLabel>
        <PaceChart variant="hero" days={DAYS} limitCents={LIMIT} spent={under} label={t.under} markerLabel={t.underMarker} locale={locale} alternative={<Table locale={locale} rows={under} />} />
      </Card>
    </Section>
  );
}
