import { CategoryTag, type SpendingCategoryId } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const names: Record<Locale, Record<SpendingCategoryId, string>> = {
  "pt-BR": {
    housing: "Moradia", "household-bills": "Contas da casa", groceries: "Mercado", "eating-out": "Comer fora",
    transport: "Transporte", health: "Saúde", education: "Educação", leisure: "Lazer", shopping: "Compras",
    subscriptions: "Assinaturas", pets: "Pets", "taxes-fees": "Impostos e taxas", other: "Outros",
  },
  en: {
    housing: "Housing", "household-bills": "Household bills", groceries: "Groceries", "eating-out": "Eating out",
    transport: "Transport", health: "Health", education: "Education", leisure: "Leisure", shopping: "Shopping",
    subscriptions: "Subscriptions", pets: "Pets", "taxes-fees": "Taxes and fees", other: "Other",
  },
};
const title = { "pt-BR": "CategoryTag", en: "CategoryTag" };

export default function CategoryTagSection({ locale }: { locale: Locale }) {
  const ids = Object.keys(names[locale]) as SpendingCategoryId[];
  return (
    <Section name={title[locale]}>
      {(["md", "sm"] as const).map((size) => (
        <ul key={size} className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {ids.map((id, i) => (
            <li key={id}>
              <CategoryTag category={id} label={names[locale][id]} share={`${40 - i * 3}%`} size={size} />
            </li>
          ))}
        </ul>
      ))}
    </Section>
  );
}
