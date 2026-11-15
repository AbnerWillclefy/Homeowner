import { Banknote, LayoutDashboard, PiggyBank, Receipt, Settings } from "lucide-react";
import { useState } from "react";
import { Sidebar, SidebarBrand } from "../../src";
import { Section } from "../Section";
import type { Locale } from "../App";

const strings = {
  "pt-BR": {
    name: "Sidebar",
    nav: "Navegação principal",
    main: "Principal",
    planning: "Planejamento",
    overview: "Visão geral",
    transactions: "Transações",
    planningItem: "Planejamento",
    bills: "Contas a pagar",
    settings: "Configurações",
    note: "Atualizado há 2 h",
    billsBadge: "3 contas em aberto",
    hint: "Abaixo de 1280px a barra mostra só os ícones.",
  },
  en: {
    name: "Sidebar",
    nav: "Main navigation",
    main: "Main",
    planning: "Planning",
    overview: "Overview",
    transactions: "Transactions",
    planningItem: "Planning",
    bills: "Bills to pay",
    settings: "Settings",
    note: "Updated 2 h ago",
    billsBadge: "3 bills open",
    hint: "Below 1280px the sidebar shows icons only.",
  },
};

export default function SidebarSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [current, setCurrent] = useState("#overview");
  const mark = (href: string, label: string, icon: typeof Receipt) => ({ href, label, icon, current: current === href });
  return (
    <Section name={t.name}>
      <p className="caption text-text-muted">{t.hint}</p>
      <div className="h-[28rem]">
        <Sidebar
          label={t.nav}
          brand={<SidebarBrand name="Homeowner" />}
          note={t.note}
          groups={[
            {
              label: t.main,
              items: [mark("#overview", t.overview, LayoutDashboard), mark("#transactions", t.transactions, Receipt)],
            },
            {
              label: t.planning,
              items: [mark("#planning", t.planningItem, PiggyBank), { ...mark("#bills", t.bills, Banknote), badge: { count: 3, label: t.billsBadge } }],
            },
          ]}
          footer={[mark("#settings", t.settings, Settings)]}
          onNavigate={setCurrent}
        />
      </div>
    </Section>
  );
}
