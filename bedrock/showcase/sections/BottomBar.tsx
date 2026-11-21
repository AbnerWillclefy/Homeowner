import { Ellipsis, LayoutDashboard, PiggyBank, Receipt } from "lucide-react";
import { useState } from "react";
import { BottomBar } from "../../src";
import { Section } from "../Section";
import type { Locale } from "../App";

const strings = {
  "pt-BR": {
    name: "BottomBar",
    nav: "Navegação do celular",
    overview: "Início",
    transactions: "Lançamentos",
    planning: "Planejar",
    more: "Mais",
    badge: "3 contas em aberto",
    hint: "Moldura de 320px, 80px por aba: cada rótulo aparece inteiro.",
  },
  en: {
    name: "BottomBar",
    nav: "Phone navigation",
    overview: "Home",
    transactions: "Transactions",
    planning: "Plan",
    more: "More",
    badge: "3 bills open",
    hint: "320px frame, 80px a tab: every label shows whole.",
  },
};

export default function BottomBarSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [current, setCurrent] = useState("#overview");
  const tab = (href: string, label: string, icon: typeof Receipt) => ({ href, label, icon, current: current === href });
  return (
    <Section name={t.name}>
      <p className="caption text-text-muted">{t.hint}</p>
      <div className="w-[320px] overflow-hidden rounded-md border border-border">
        <BottomBar
          label={t.nav}
          items={[
            tab("#overview", t.overview, LayoutDashboard),
            { ...tab("#transactions", t.transactions, Receipt), badge: { count: 3, label: t.badge } },
            tab("#planning", t.planning, PiggyBank),
            tab("#more", t.more, Ellipsis),
          ]}
          onNavigate={setCurrent}
        />
      </div>
    </Section>
  );
}
