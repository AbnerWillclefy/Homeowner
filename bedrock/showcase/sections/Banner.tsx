import { WifiOff } from "lucide-react";
import { Banner, Button, Card, CardContent, CardHeader, CardLabel } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "Banner",
    label: "Metas",
    error: "Não foi possível carregar suas metas.",
    retry: "Tentar de novo",
    offline: "Sem conexão. Mostrando dados de 10:42",
    info: "Os valores de ontem já estão fechados.",
  },
  en: {
    name: "Banner",
    label: "Goals",
    error: "Couldn't load your goals.",
    retry: "Try again",
    offline: "No connection. Showing data from 10:42",
    info: "Yesterday's amounts are already closed.",
  },
};

export default function BannerSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <Card>
        <CardHeader>
          <CardLabel>{t.label}</CardLabel>
        </CardHeader>
        <CardContent>
          <Banner tone="danger" action={<Button variant="ghost" size="sm">{t.retry}</Button>}>
            {t.error}
          </Banner>
        </CardContent>
      </Card>
      <Banner tone="warning" icon={WifiOff}>{t.offline}</Banner>
      <Banner>{t.info}</Banner>
    </Section>
  );
}
