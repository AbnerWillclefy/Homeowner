import { Card } from "../components/ui/Card";
import { useI18n } from "../i18n";
import { INSTALL_STEP_KEYS } from "./installSteps";

/** The iPhone Add to Home Screen steps. Onboarding supplies its own heading, so it turns this one off. */
export function InstallSteps({ showHeading = true }: { showHeading?: boolean }) {
  const { t } = useI18n();
  const body = (
    <>
      {showHeading && <h2 id="install-heading">{t("install.heading")}</h2>}
      <p>{t("install.intro")}</p>
      <ol>
        {INSTALL_STEP_KEYS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
      <p>{t("install.outro")}</p>
    </>
  );
  // With its own heading it is a card on the Me tab; inside onboarding the step supplies the surface.
  return showHeading ? (
    <Card as="section" aria-labelledby="install-heading">
      {body}
    </Card>
  ) : (
    <section>{body}</section>
  );
}
