import { useMemo } from "react";
import type { Home } from "../api/home";
import { useI18n } from "../i18n";
import { browserTimezones } from "./browserTimezones";
import { saveSettings } from "./createOrLoad";
import { FormStatusMessage } from "./FormStatusMessage";
import { HomeFields } from "./HomeFields";
import { timezoneOptions } from "./timezones";
import { useSettingsForm } from "./useSettingsForm";

interface Props {
  home: Home;
  onSaved(home: Home): void;
}

/** A Resident's view of the Home's settings, editable by any Resident. */
export function HomeSettingsForm({ home, onSaved }: Props) {
  const { t } = useI18n();
  const options = useMemo(() => timezoneOptions(browserTimezones(), home.timezone), [home.timezone]);
  const form = useSettingsForm(
    { timezone: home.timezone, allocationTime: home.allocationTime },
    (settings) => saveSettings(settings),
    (saved) => onSaved(saved),
  );
  const saving = form.status.kind === "saving";

  return (
    <section aria-labelledby="home-settings-heading">
      <h2 id="home-settings-heading">{t("home.settings.heading")}</h2>
      <p>{t("home.settings.intro")}</p>
      <form onSubmit={form.submit} noValidate>
        <HomeFields
          idPrefix="home-settings"
          values={form.values}
          timezones={options}
          fieldErrors={form.status.kind === "invalid" ? form.status.fields : {}}
          disabled={saving}
          onChange={form.change}
        />
        <FormStatusMessage status={form.status} />
        {form.status.kind === "saved" && <p role="status">{t("home.settings.saved")}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t("home.settings.saving") : t("home.settings.save")}
        </button>
      </form>
    </section>
  );
}
