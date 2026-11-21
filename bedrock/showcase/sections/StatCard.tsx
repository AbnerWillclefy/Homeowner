import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "../../src";
import { StatCard } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "StatCard", balance: "Saldo do mês", spent: "Gastos", delta: "R$ 200 abaixo", up: "+3%", hint: "Até o fim do mês", hiddenLabel: "Valor oculto" },
  en: { name: "StatCard", balance: "Month balance", spent: "Spending", delta: "R$ 200 under", up: "+3%", hint: "Until month end", hiddenLabel: "Hidden value" },
};

export default function StatCardSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <StatCard size="hero" label={t.balance} cents={218341} reference={498300} locale={locale} delta={<Badge tone="solid" icon={TrendingDown}>{t.delta}</Badge>} />
      <StatCard label={t.spent} cents={218341} reference={498300} locale={locale} delta={<Badge tone="positive" icon={TrendingUp}>{t.up}</Badge>} hint={t.hint} />
      <StatCard label={t.spent} cents={218341} locale={locale} hidden hiddenLabel={t.hiddenLabel} />
    </Section>
  );
}
