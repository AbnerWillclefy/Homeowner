import { CalendarClock, CircleAlert, CircleCheck, Clock, Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Badge", neutral: "Agendada", positive: "Paga", warning: "Vence em 2 dias", danger: "Atrasada", brand: "Nova", solid: "R$ 200 abaixo" },
  en: { name: "Badge", neutral: "Scheduled", positive: "Paid", warning: "Due in 2 days", danger: "Late", brand: "New", solid: "R$ 200 under" },
};

export default function BadgeSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <div className="flex flex-wrap items-center gap-4">
        <Badge tone="neutral" icon={CalendarClock}>{t.neutral}</Badge>
        <Badge tone="positive" icon={CircleCheck}>{t.positive}</Badge>
        <Badge tone="warning" icon={Clock}>{t.warning}</Badge>
        <Badge tone="danger" icon={CircleAlert}>{t.danger}</Badge>
        <Badge tone="brand" icon={Sparkles}>{t.brand}</Badge>
        <Badge tone="solid" icon={TrendingDown}>{t.solid}</Badge>
      </div>
    </Section>
  );
}
