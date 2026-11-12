import { CircleCheck, PiggyBank, SearchX } from "lucide-react";
import { EmptyState } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    first: ["Nenhuma meta ainda", "Suas metas vão aparecer aqui depois que você criar a primeira.", "Criar meta"],
    none: ["Nada encontrado", "Nenhum gasto combina com esses filtros.", "Limpar filtros"],
    done: ["Todas as contas pagas", "Não há contas em aberto neste mês."],
  },
  en: {
    first: ["No goals yet", "Your goals will show up here once you create the first one.", "Create goal"],
    none: ["Nothing found", "No spending matches these filters.", "Clear filters"],
    done: ["All bills paid", "There are no open bills this month."],
  },
};

export default function EmptyStateSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name="EmptyState">
      <EmptyState icon={PiggyBank} title={t.first[0]} message={t.first[1]} action={{ label: t.first[2], onClick: () => {} }} />
      <EmptyState icon={PiggyBank} title={t.first[0]} message={t.first[1]} />
      <EmptyState kind="no-results" icon={SearchX} title={t.none[0]} message={t.none[1]} action={{ label: t.none[2], onClick: () => {} }} />
      <EmptyState kind="done" icon={CircleCheck} title={t.done[0]} message={t.done[1]} />
    </Section>
  );
}
