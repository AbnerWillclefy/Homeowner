import { Streak } from "../../src/home";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { running: (n: number) => `Sequência: ${n} dias`, paused: (n: number) => `Sequência pausada: ${n} dias`, zero: "Sequência: 0 dias" },
  en: { running: (n: number) => `Streak: ${n} days`, paused: (n: number) => `Streak paused: ${n} days`, zero: "Streak: 0 days" },
};

export default function StreakSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name="Streak">
      <div className="flex flex-wrap gap-2">
        <Streak days={6} label={t.running(6)} />
        <Streak days={6} paused label={t.paused(6)} />
        <Streak days={0} label={t.zero} />
      </div>
    </Section>
  );
}
