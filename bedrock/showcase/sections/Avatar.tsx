import { Avatar } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Avatar", photo: "Foto que não carrega", initials: "Iniciais", none: "Sem nome" },
  en: { name: "Avatar", photo: "Photo that fails to load", initials: "Initials", none: "No name" },
};

export default function AvatarSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <ul className="flex flex-wrap items-center gap-6">
        <li className="flex items-center gap-2">
          <Avatar size="lg" initials="MS" />
          <span className="body">{t.initials}</span>
        </li>
        <li className="flex items-center gap-2">
          <Avatar size="md" src="/missing.png" initials="AB" fillClass="bg-warning-soft" inkClass="text-warning" />
          <span className="body">{t.photo}</span>
        </li>
        <li className="flex items-center gap-2">
          <Avatar size="sm" />
          <span className="body">{t.none}</span>
        </li>
      </ul>
    </Section>
  );
}
