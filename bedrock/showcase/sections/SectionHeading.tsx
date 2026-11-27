import { Button, SectionHeading } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "SectionHeading", mine: "Suas tarefas", accept: "Aceitar todas", done: "Concluídas hoje", caption: "Ana · 2 de 3 feitas" },
  en: { name: "SectionHeading", mine: "Your Tasks", accept: "Accept all", done: "Done today", caption: "Ana · 2 of 3 done" },
};

export default function SectionHeadingSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <div className="flex flex-col gap-4">
        <SectionHeading as="h3" variant="title" title={t.mine} end={<Button variant="ghost">{t.accept}</Button>} />
        <SectionHeading as="h3" variant="title" title={t.mine} end={<span className="label text-text-muted">{t.caption}</span>} />
        <SectionHeading as="h3" variant="label" title={t.done} />
      </div>
    </Section>
  );
}
