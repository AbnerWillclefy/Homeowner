import { Button, Card, CardContent, CardFooter, CardHeader, CardLabel } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Card", label: "Gastos do mês", body: "Quatro categorias passaram do planejado.", footer: "Atualizado hoje", details: "Ver detalhes" },
  en: { name: "Card", label: "Spending this month", body: "Four categories went over plan.", footer: "Updated today", details: "See details" },
};

export default function CardSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const content = (
    <>
      <CardHeader>
        <CardLabel>{t.label}</CardLabel>
      </CardHeader>
      <CardContent>
        <p className="body">{t.body}</p>
      </CardContent>
    </>
  );
  return (
    <Section name={t.name}>
      <Card>
        {content}
        <CardFooter>
          <Button size="sm" variant="secondary">{t.details}</Button>
          <span className="caption text-text-muted">{t.footer}</span>
        </CardFooter>
      </Card>
      <Card variant="compact">{content}</Card>
      <Card variant="hero">{content}</Card>
      <Card asChild>
        <a href="#card">{content}</a>
      </Card>
    </Section>
  );
}
