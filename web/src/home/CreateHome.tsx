import { useMemo } from "react";
import type { Home } from "../api/home";
import { useI18n } from "../i18n";
import { DEFAULT_ALLOCATION_TIME } from "./allocationTimes";
import { browserTimezone, browserTimezones } from "./browserTimezones";
import { createOrLoad } from "./createOrLoad";
import { FormStatusMessage } from "./FormStatusMessage";
import { HomeFields } from "./HomeFields";
import { defaultTimezone, timezoneOptions } from "./timezones";
import { useSettingsForm } from "./useSettingsForm";

interface Props {
  onSaved(home: Home, recovered: boolean): void;
}

/** For a signed-in User with no Home: pick a timezone and Allocation time, and become its first Resident. */
export function CreateHome({ onSaved }: Props) {
  const { t } = useI18n();
  const zones = useMemo(() => browserTimezones(), []);
  const options = useMemo(() => timezoneOptions(zones), [zones]);
  const form = useSettingsForm(
    { timezone: defaultTimezone(zones, browserTimezone()), allocationTime: DEFAULT_ALLOCATION_TIME },
    (settings) => createOrLoad(settings),
    onSaved,
  );
  const saving = form.status.kind === "saving";

  return (
    <section aria-labelledby="create-home-heading">
      <h2 id="create-home-heading">{t("home.create.heading")}</h2>
      <p>{t("home.create.intro")}</p>
      <form onSubmit={form.submit} noValidate>
        <HomeFields
          idPrefix="create-home"
          values={form.values}
          timezones={options}
          fieldErrors={form.status.kind === "invalid" ? form.status.fields : {}}
          disabled={saving}
          onChange={form.change}
        />
        <FormStatusMessage status={form.status} />
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t("home.create.submitting") : t("home.create.submit")}
        </button>
      </form>
    </section>
  );
}
