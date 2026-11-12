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
    transactions: "Transações",
    planning: "Planejamento financeiro",
    more: "Mais",
    hint: "Moldura de 390px. O terceiro rótulo é longo de propósito e é cortado.",
  },
  en: {
    name: "BottomBar",
    nav: "Phone navigation",
    overview: "Home",
    transactions: "Transactions",
    planning: "Long-term financial planning",
    more: "More",
    hint: "390px frame. The third label is long on purpose and gets truncated.",
  },
};

export default function BottomBarSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [current, setCurrent] = useState("#overview");
  const tab = (href: string, label: string, icon: typeof Receipt) => ({ href, label, icon, current: current === href });
  return (
    <Section name={t.name}>
      <p className="caption text-text-muted">{t.hint}</p>
      <div className="max-w-[390px] overflow-hidden rounded-md border border-border">
        <BottomBar
          label={t.nav}
          items={[
            tab("#overview", t.overview, LayoutDashboard),
            tab("#transactions", t.transactions, Receipt),
            tab("#planning", t.planning, PiggyBank),
            tab("#more", t.more, Ellipsis),
          ]}
          onNavigate={setCurrent}
        />
      </div>
    </Section>
  );
}
