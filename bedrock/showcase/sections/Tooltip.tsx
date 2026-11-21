import { EyeOff } from "lucide-react";
import { Button, Tooltip } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": { name: "Tooltip", hint: "Passe o mouse ou foque o botão. Esc fecha.", label: "Esconder valores" },
  en: { name: "Tooltip", hint: "Hover or focus the button. Esc closes it.", label: "Hide values" },
};

export default function TooltipSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  return (
    <Section name={t.name}>
      <p className="caption text-text-muted">{t.hint}</p>
      <div>
        <Tooltip label={t.label}>
          <Button variant="ghost" size="sm">
            <EyeOff className="size-4" aria-hidden />
            <span className="sr-only">{t.label}</span>
          </Button>
        </Tooltip>
      </div>
    </Section>
  );
}
