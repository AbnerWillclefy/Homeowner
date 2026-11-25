import { CalendarDays, Plus } from "lucide-react";
import { Button, PageHeader } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "PageHeader", title: "Contas", subtitle: "Novembro de 2026 · 3 contas", period: "Novembro de 2026", add: "Nova conta" },
  en: { name: "PageHeader", title: "Bills", subtitle: "November 2026 · 3 bills", period: "November 2026", add: "New bill" },
};

export default function PageHeaderSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      {/* The showcase page has its own h1; this one is the component's own, so only one is shown per screen in the app. */}
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        period={
          <Button variant="secondary" icon={CalendarDays} className="w-full">
            {t.period}
          </Button>
        }
        action={{ label: t.add, icon: Plus, onClick: () => {} }}
      />
    </Section>
  );
}
