import { AlertCard } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    info: ["Dica de organização", "Agrupar as contas por vencimento pode ajudar a planejar o mês."],
    success: ["Conta paga", "A conta de água deste mês está em dia."],
    warning: ["Faltam 3 dias para a conta de luz", "O vencimento é na sexta-feira."],
    danger: ["Conta de internet atrasada", "O vencimento foi ontem e podem ser cobrados juros."],
    action: "Ver conta",
  },
  en: {
    info: ["Organising tip", "Grouping bills by due date can help you plan the month."],
    success: ["Bill paid", "This month's water bill is up to date."],
    warning: ["3 days left for the electricity bill", "It is due on Friday."],
    danger: ["Internet bill is late", "It was due yesterday and interest may apply."],
    action: "View bill",
  },
};

const tones = ["info", "success", "warning", "danger"] as const;

export default function AlertCardSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name="AlertCard">
      {tones.map((tone) => (
        <AlertCard
          key={tone}
          tone={tone}
          title={t[tone][0]}
          message={t[tone][1]}
          action={tone === "warning" || tone === "danger" ? { label: t.action, onClick: () => {} } : undefined}
        />
      ))}
    </Section>
  );
}
