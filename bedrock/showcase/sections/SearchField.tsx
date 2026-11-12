import { useState } from "react";
import { SearchField } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { label: "Buscar transações", clear: "Limpar busca", placeholder: "Buscar" },
  en: { label: "Search transactions", clear: "Clear search", placeholder: "Search" },
};

export default function SearchFieldSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [empty, setEmpty] = useState("");
  const [filled, setFilled] = useState(locale === "en" ? "groceries" : "mercado");
  return (
    <Section name="SearchField">
      <SearchField label={t.label} clearLabel={t.clear} placeholder={t.placeholder} value={empty} onValueChange={setEmpty} />
      <SearchField label={t.label} clearLabel={t.clear} value={filled} onValueChange={setFilled} />
    </Section>
  );
}
