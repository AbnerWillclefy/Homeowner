import { useEffect } from "react";
import type { Chore } from "../api/chores";
import { PREFERENCES, type Preference } from "../api/profile";
import { AppDialog } from "../components/ui/AppDialog";
import { CardRow } from "../components/ui/CardRow";
import { useI18n, type MessageKey } from "../i18n";
import { effortName } from "../chores/effortLevels";
import { categoryLabel, labelText, type Label } from "../profile/labels";
import { useRatingStep } from "./useRatingStep";

const PREFERENCE_KEY: Record<Preference, MessageKey> = {
  like: "profile.preference.like",
  neutral: "profile.preference.neutral",
  dislike: "profile.preference.dislike",
};

interface Props {
  /** The step is over: skipped, done, or there was nothing to rate. Escape and a tap outside do the same. */
  onClose(): void;
}

/**
 * A dialog over Today, shown once right after joining a Home: rate the Home's most demanding Chores and mark any
 * that cannot be done. It is skippable, and closes by itself when the Home has no Chores.
 */
export function RatingStep({ onClose }: Props) {
  const { t } = useI18n();
  const { state, settingOf, setPreference, setRestricted } = useRatingStep();
  const empty = state.kind === "ready" && state.chores.length === 0;

  useEffect(() => {
    if (empty) onClose();
  }, [empty, onClose]);

  const text = (label: Label) => labelText(t, label);

  // Nothing to rate: closing, so do not flash the dialog.
  if (empty) return null;

  return (
    <AppDialog title={t("invite.rating.heading")} onDismiss={onClose}>
      {state.kind === "loading" && <p role="status">{t("invite.rating.loading")}</p>}
      {state.kind === "problem" && <p role="alert">{t("invite.rating.problem")}</p>}

      {state.kind === "ready" && state.chores.length > 0 && (
        <ul className="p-0">
          {state.chores.map((chore: Chore) => {
            const setting = settingOf(chore.id);
            const nameId = `rating-name-${chore.id}`;
            return (
              <li key={chore.id} className="list-none ps-0">
                <CardRow
                  role="group"
                  aria-labelledby={nameId}
                  className="mt-3"
                  actions={
                    <div className="flex flex-col">
                      {PREFERENCES.map((value) => (
                        <label key={value} className="flex items-center gap-2 min-h-11 mt-0 font-normal">
                          <input
                            type="radio"
                            name={`rating-preference-${chore.id}`}
                            className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
                            checked={setting.preference === value}
                            onChange={() => setPreference(chore.id, value, setting.preference)}
                          />
                          {t(PREFERENCE_KEY[value])}
                        </label>
                      ))}
                    </div>
                  }
                >
                  <p id={nameId} className="mt-0 font-semibold">
                    {chore.name}
                  </p>
                  <p className="mt-0">
                    {text(categoryLabel(chore.category))}, {t("chores.item.effort", { level: effortName(t, chore.baseEffort) })}
                  </p>
                  <label className="flex items-center gap-3 min-h-11 font-normal">
                    <input
                      type="checkbox"
                      className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
                      checked={setting.restricted}
                      onChange={(event) => setRestricted(chore.id, event.target.checked)}
                    />
                    {t("invite.rating.restricted")}
                  </label>
                </CardRow>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className={state.kind === "ready" ? "btn btn-primary" : "btn"} onClick={onClose}>
        {state.kind === "ready" ? t("invite.rating.done") : t("invite.rating.skip")}
      </button>
    </AppDialog>
  );
}
