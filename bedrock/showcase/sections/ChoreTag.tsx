import { Bath, BedDouble, Brush, CookingPot, PawPrint, Shapes, Shirt, Sofa, Trash2, Trees } from "lucide-react";
import { ChoreTag, type ChoreCategory } from "../../src/home";
import type { Locale } from "../App";
import { Section } from "../Section";

const categories: [ChoreCategory, Record<Locale, string>][] = [
  [{ tone: "kitchen", icon: CookingPot }, { "pt-BR": "Cozinha", en: "Kitchen" }],
  [{ tone: "bathroom", icon: Bath }, { "pt-BR": "Banheiro", en: "Bathroom" }],
  [{ tone: "bedroom", icon: BedDouble }, { "pt-BR": "Quarto", en: "Bedroom" }],
  [{ tone: "living-room", icon: Sofa }, { "pt-BR": "Sala", en: "Living room" }],
  [{ tone: "laundry", icon: Shirt }, { "pt-BR": "Roupas", en: "Laundry" }],
  [{ tone: "floors", icon: Brush }, { "pt-BR": "Pisos", en: "Floors" }],
  [{ tone: "trash", icon: Trash2 }, { "pt-BR": "Lixo", en: "Trash" }],
  [{ tone: "outdoor", icon: Trees }, { "pt-BR": "Área externa", en: "Outdoor" }],
  [{ tone: "pets", icon: PawPrint }, { "pt-BR": "Pets", en: "Pets" }],
  [{ tone: "other", icon: Shapes }, { "pt-BR": "Outros", en: "Other" }],
];

export default function ChoreTagSection({ locale }: { locale: Locale }) {
  return (
    <Section name="ChoreTag">
      {(["lg", "md", "sm"] as const).map((size) => (
        <ul key={size} className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {categories.map(([category, names]) => (
            <li key={category.tone}>
              <ChoreTag category={category} label={names[locale]} size={size} />
            </li>
          ))}
        </ul>
      ))}
    </Section>
  );
}
