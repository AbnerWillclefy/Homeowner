import type { Home, HomeSettings } from "../api/home";
import { PillButton } from "../components/ui/PillButton";
import { useI18n, type MessageKey } from "../i18n";
import { FormStatusMessage } from "./FormStatusMessage";
import { HomeFields } from "./HomeFields";
import { useSettingsForm, type SaveOutcome } from "./useSettingsForm";

interface Copy {
  heading: MessageKey;
  intro: MessageKey;
  submit: MessageKey;
  submitting: MessageKey;
  /** The status line after a save. Left out where the form goes away on success. */
  saved?: MessageKey;
}

interface Props {
  /** Also names the heading id and the field ids, so two forms on a page never share one. */
  idPrefix: string;
  copy: Copy;
  initial: HomeSettings;
  timezones: readonly string[];
  save(settings: HomeSettings): Promise<SaveOutcome>;
  onSaved(home: Home): void;
  onRecovered?(home: Home): void;
}

/** The form for a Home's settings, shared by creating one and editing it. */
export function HomeForm({ idPrefix, copy, initial, timezones, save, onSaved, onRecovered }: Props) {
  const { t } = useI18n();
  const form = useSettingsForm(initial, save, onSaved, onRecovered);
  const saving = form.status.kind === "saving";

  return (
    <section aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`}>{t(copy.heading)}</h2>
      <p>{t(copy.intro)}</p>
      <form onSubmit={form.submit} noValidate>
        <HomeFields
          idPrefix={idPrefix}
          values={form.values}
          timezones={timezones}
          fieldErrors={form.status.kind === "invalid" ? form.status.fields : {}}
          disabled={saving}
          onChange={form.change}
        />
        <FormStatusMessage status={form.status} />
        {copy.saved && form.status.kind === "saved" && <p role="status">{t(copy.saved)}</p>}
        <PillButton type="submit" variant="primary" className="mt-4" disabled={saving}>
          {t(saving ? copy.submitting : copy.submit)}
        </PillButton>
      </form>
    </section>
  );
}
