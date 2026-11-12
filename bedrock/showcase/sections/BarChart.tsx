import { useState } from "react";
import { Card, SegmentedControl } from "../../src";
import { BarChart, formatAmount } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "BarChart",
    period: "Período",
    periods: ["7d", "30d"],
    label: "Gasto diário acima da média em 3 dias",
    legend: { daily: "Diário", average: "Média de 7 dias", target: "Limite" },
    day: "Dia",
    spent: "Gasto",
    why: "Aluguel",
  },
  en: {
    name: "BarChart",
    period: "Period",
    periods: ["7d", "30d"],
    label: "Daily spending above average on 3 days",
    legend: { daily: "Daily", average: "7-day average", target: "Limit" },
    day: "Day",
    spent: "Spent",
    why: "Rent",
  },
};

const series = (n: number) => {
  const cents = Array.from({ length: n }, (_, i) => 8000 + ((i * 7919) % 9000) + (i === 2 ? 30000 : 0));
  return cents.map((c, i) => {
    const window = cents.slice(Math.max(0, i - 6), i + 1);
    return { label: String(i + 1), cents: c, average: Math.round(window.reduce((a, b) => a + b, 0) / window.length), why: i === 2 ? "Aluguel" : undefined };
  });
};

export default function BarChartSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [period, setPeriod] = useState("7d");
  const data = series(period === "7d" ? 7 : 30).map((d) => ({ ...d, why: d.why && t.why }));
  return (
    <Section name={t.name}>
      <SegmentedControl
        label={t.period}
        value={period}
        onValueChange={setPeriod}
        options={["7d", "30d"].map((value, i) => ({ value, label: t.periods[i] }))}
      />
      <Card>
        <BarChart
          data={data}
          targetCents={15000}
          label={t.label}
          legend={t.legend}
          locale={locale}
          alternative={
            <table>
              <caption>{t.spent}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.day}</th>
                  <th scope="col">{t.spent}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.label}>
                    <td>{d.label}</td>
                    <td>{formatAmount(d.cents, { locale })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </Card>
    </Section>
  );
}
