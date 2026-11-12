import { Amount, formatAmount } from "../../src/finance";
import { Section } from "../Section";
import type { Locale } from "../App";

const strings = {
  "pt-BR": { sizes: "Tamanhos", income: "Entrada", reference: "Com referência", hidden: "Oculto", hiddenLabel: "Valor oculto", compact: "Formas compactas" },
  en: { sizes: "Sizes", income: "Income", reference: "With reference", hidden: "Hidden", hiddenLabel: "Hidden value", compact: "Compact forms" },
};

export default function AmountSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const row = "flex flex-col gap-1";
  return (
    <Section name="Amount">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className={row}>
          <span className="label text-text-muted">{t.sizes}</span>
          <Amount cents={218341} size="hero" />
          <Amount cents={218341} size="lg" />
          <Amount cents={218341} size="md" />
          <Amount cents={218341} size="sm" />
        </div>
        <div className={row}>
          <span className="label text-text-muted">{t.income}</span>
          <Amount cents={450000} size="md" income />
        </div>
        <div className={row}>
          <span className="label text-text-muted">{t.reference}</span>
          <Amount cents={218341} size="lg" reference={498300} />
        </div>
        <div className={row}>
          <span className="label text-text-muted">{t.hidden}</span>
          <Amount cents={218341} size="lg" hidden hiddenLabel={t.hiddenLabel} />
        </div>
        <div className={row}>
          <span className="label text-text-muted">{t.compact}</span>
          <span className="body tabular-nums">
            {[49900, 800000, 1250000, 120000000].map((c) => formatAmount(c, { precision: "compact" })).join("  ·  ")}
          </span>
        </div>
      </div>
    </Section>
  );
}
