import { useI18n } from "../i18n";
import { INSTALL_STEP_KEYS } from "./installStepKeys";

/** The iPhone Add to Home Screen steps. Onboarding supplies its own heading, so it turns this one off. */
export function InstallSteps({ showHeading = true }: { showHeading?: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby={showHeading ? "install-heading" : undefined}>
      {showHeading && <h2 id="install-heading">{t("install.heading")}</h2>}
      <ol>
        {INSTALL_STEP_KEYS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </section>
  );
}
