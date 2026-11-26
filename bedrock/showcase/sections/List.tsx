import { ChevronRight, ShoppingBasket } from "lucide-react";
import { List, Row } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "List", market: "Mercado", marketCaption: "Nubank · 24/11", plain: "Aluguel", button: "Abrir como botão", link: "Abrir como link", long: "Transferência recebida de Maria Aparecida dos Santos Oliveira", longCaption: "Itaú · 23/11 · conta corrente compartilhada com a família" },
  en: { name: "List", market: "Groceries", marketCaption: "Nubank · 11/24", plain: "Rent", button: "Open as a button", link: "Open as a link", long: "Transfer received from Maria Aparecida dos Santos Oliveira", longCaption: "Itaú · 11/23 · joint checking account shared with the family" },
};

export default function ListSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const tile = (
    <span className="flex size-10 items-center justify-center rounded-md bg-surface-sunken">
      <ShoppingBasket aria-hidden className="size-5" />
    </span>
  );
  const chevron = <ChevronRight aria-hidden className="size-5 text-text-muted" />;
  return (
    <Section name={t.name}>
      <List>
        <Row leading={tile} title={t.market} caption={t.marketCaption} />
        <Row title={t.plain} />
        <Row asChild leading={tile} title={t.button} caption={t.marketCaption} trailing={chevron}>
          <button type="button" />
        </Row>
        <Row asChild title={t.link} trailing={chevron}>
          <a href="#list" />
        </Row>
        <Row leading={tile} title={t.long} caption={t.longCaption} trailing={chevron} />
      </List>
    </Section>
  );
}
