import { ExternalLink } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";

const MEUPLUGGY = "https://meu.pluggy.ai";

/** Why and how to get the Client ID and Secret, before the form asks for them. */
export function SetupSteps() {
  const { t } = useI18n();
  return (
    <Card as="section" aria-labelledby="finances-steps-heading" className="flex flex-col gap-3">
      <h3 id="finances-steps-heading" className="my-0 text-lg font-bold leading-snug">
        {t("finances.steps.heading")}
      </h3>
      <ol className="my-0 flex list-decimal flex-col gap-3 ps-5 *:[overflow-wrap:anywhere]">
        <li>
          {t("finances.steps.one")}
          <div className="mt-1">
            <Button asChild variant="link">
              <a href={MEUPLUGGY} target="_blank" rel="noopener noreferrer">
                {t("finances.steps.link")}
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </Button>
          </div>
        </li>
        <li>{t("finances.steps.two")}</li>
        <li>{t("finances.steps.three")}</li>
      </ol>
    </Card>
  );
}
