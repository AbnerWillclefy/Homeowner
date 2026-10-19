import type { Home, HomeSettings } from "../api/api";
import { useToast } from "../../../shared/ui/useToast";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Button } from "../../../shared/ui/Button";
import { FormStatusMessage } from "./FormStatusMessage";
import { HomeFields } from "./HomeFields";
import { useSettingsForm, type SaveOutcome } from "../hooks/useSettingsForm";

interface Copy {
  hint: MessageKey;
  submit: MessageKey;
  /** The toast after a save. Left out where the form goes away on success. */
  saved?: MessageKey;
}

interface Props {
  /** Names the field ids, so two forms on a page never share one. */
  idPrefix: string;
  copy: Copy;
  initial: HomeSettings;
  timezones: readonly string[];
  save(settings: HomeSettings): Promise<SaveOutcome>;
  onSaved(home: Home): void;
  onRecovered?(home: Home): void;
}

/** The form for a Home's settings: a hint, then the fields. The caller's card names it. */
export function HomeForm({ idPrefix, copy, initial, timezones, save, onSaved, onRecovered }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const form = useSettingsForm(
    initial,
    save,
    (home) => {
      if (copy.saved) toast.show({ messageKey: copy.saved, tone: "success" });
      onSaved(home);
    },
    onRecovered,
  );
  const saving = form.status.kind === "saving";

  return (
    <>
      <p className="my-0 text-sm text-muted">{t(copy.hint)}</p>
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
        <ButtonRow
          className="mt-4"
          end={
            <Button type="submit" variant="primary" pending={saving}>
              {t(copy.submit)}
            </Button>
          }
        />
      </form>
    </>
  );
}
