import { CircleCheck } from "lucide-react";
import { Badge } from "../../src";
import { CategoryIcon, ListRow } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "ListRow", market: "Mercado", marketSub: "Nubank · 24/11", long: "Transferência recebida de Maria Aparecida dos Santos Oliveira", longSub: "Itaú · 23/11", paid: "Paga", rent: "Aluguel", hiddenLabel: "Valor oculto", narrow: "Coluna estreita" },
  en: { name: "ListRow", market: "Groceries", marketSub: "Nubank · 11/24", long: "Transfer received from Maria Aparecida dos Santos Oliveira", longSub: "Itaú · 11/23", paid: "Paid", rent: "Rent", hiddenLabel: "Hidden value", narrow: "Narrow column" },
};

export default function ListRowSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const list = "divide-y divide-border rounded-lg border border-border bg-surface p-2";
  return (
    <Section name={t.name}>
      <ul className={list}>
        <li>
          <ListRow asChild leading={<CategoryIcon category="groceries" />} title={t.market} subtitle={t.marketSub} cents={-18990} locale={locale} end={<Badge tone="positive" icon={CircleCheck}>{t.paid}</Badge>}>
            <button type="button" />
          </ListRow>
        </li>
        <li>
          <ListRow leading={<CategoryIcon category="housing" />} title={t.rent} subtitle={t.marketSub} cents={-250000} locale={locale} />
        </li>
        <li>
          <ListRow leading={<CategoryIcon category="other" />} title={t.market} cents={-18990} locale={locale} hidden hiddenLabel={t.hiddenLabel} />
        </li>
      </ul>
      <p className="label text-text-muted">{t.narrow}</p>
      <ul className={`${list} max-w-[18rem]`}>
        <li>
          <ListRow asChild leading={<CategoryIcon category="other" />} title={t.long} subtitle={t.longSub} cents={450000} income locale={locale}>
            <a href="#row" />
          </ListRow>
        </li>
      </ul>
    </Section>
  );
}
