import { Button } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Button", pay: "Marcar como pago", save: "Salvar", cancel: "Cancelar", more: "Ver detalhes", remove: "Excluir conta", paid: "3 contas pagas", loading: "Salvando", disabled: "Indisponível", link: "Abrir conta" },
  en: { name: "Button", pay: "Mark as paid", save: "Save", cancel: "Cancel", more: "View details", remove: "Delete bill", paid: "3 bills paid", loading: "Saving", disabled: "Unavailable", link: "Open bill" },
};

export default function ButtonSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <div className="flex flex-wrap items-center gap-4">
        <Button>{t.pay}</Button>
        <Button variant="secondary">{t.cancel}</Button>
        <Button variant="ghost">{t.more}</Button>
        <Button variant="danger">{t.remove}</Button>
        <Button variant="success">{t.paid}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm">{t.save}</Button>
        <Button size="md">{t.save}</Button>
        <Button size="lg">{t.save}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button loading>{t.loading}</Button>
        <Button variant="secondary" loading>{t.loading}</Button>
        <Button disabled>{t.disabled}</Button>
        <Button variant="secondary" disabled>{t.disabled}</Button>
        <Button asChild variant="secondary">
          <a href="#button">{t.link}</a>
        </Button>
      </div>
    </Section>
  );
}
