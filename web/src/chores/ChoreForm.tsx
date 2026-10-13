import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Chore, ChoreWire, SaveChoreResult } from "./api";
import type { FieldCodes } from "../home/api";
import { WEEKDAYS } from "../profile/api";
import { AppDialog } from "../shared/ui/AppDialog";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { Card } from "../shared/ui/Card";
import { useI18n, type MessageKey } from "../shared/i18n";
import { categoryLabel, demandLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../profile/weekdays";
import { Button } from "../shared/ui/Button";
import { choreFieldErrorKey } from "./fieldErrors";
import { SAVE_FAILURE_KEY } from "./failureMessages";
import { EFFORT_LEVELS, effortLevelKey, levelToEffort } from "./effortLevels";
import { toggled, type ChoreFormState } from "./form";
import { INTERVAL_PRESETS, intervalForPreset, presetForText, type IntervalPreset } from "./intervalPresets";
import { suggestTwoPerson } from "./suggestion";
import { useChoreForm } from "./useChoreForm";

const IMPORTANCES = ["essential", "normal", "nice_to_have"];
const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-center gap-3 min-h-11 mt-0 font-normal";

interface RadioOption<V> {
  value: V;
  label: string;
}

interface Props {
  /** What the form starts with: an existing Chore, a Catalog entry, a suggestion, or `emptyForm()`. */
  initial: ChoreFormState;
  /** Edit words the heading and button as a change to something that exists; create as a new Chore. */
  mode: "create" | "edit";
  /** Names the element ids, so two forms on a page never share one. */
  idKey: string;
  categories: readonly string[];
  demands: readonly string[];
  /** Errors to show from the start, keyed by field, for a form opened to fix what the API refused. */
  initialErrors?: FieldCodes;
  save(input: ChoreWire): Promise<SaveChoreResult>;
  /** Gets the saved Chore and the form values it was saved from. */
  onSaved(chore: Chore, values: ChoreFormState): void;
  /** Also called by Escape and a tap outside when the form is in a dialog. */
  onCancel(): void;
  /** Show the form in a near-full-height dialog with Cancel and Save pinned below it, instead of in a card. */
  inDialog?: boolean;
}

/** The create and edit form for a Chore: every field, the API's field errors beside their controls. */
export function ChoreForm({
  initial,
  mode,
  idKey,
  categories,
  demands,
  initialErrors,
  save,
  onSaved,
  onCancel,
  inDialog = false,
}: Props) {
  const { t, locale } = useI18n();
  const form = useChoreForm(initial, save, onSaved, initialErrors);
  const { values, status } = form;
  const saving = status.kind === "saving";
  const fieldErrors = status.kind === "invalid" ? status.fields : {};
  const idPrefix = `chore-form-${idKey}`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // An existing interval opens on its matching preset, or on Custom with its days typed in.
  const initialPreset = presetForText(initial.intervalDays);
  const [preset, setPreset] = useState<IntervalPreset>(initialPreset);
  // The days typed under Custom, kept while a named preset is chosen.
  const customText = useRef(initialPreset === "custom" ? initial.intervalDays : "");

  // Inline, the form appears in place of a button, so move the reader to it. A dialog focuses its own title.
  useEffect(() => {
    if (!inDialog) headingRef.current?.focus();
  }, [inDialog]);

  const text = (label: Label) => labelText(t, label);
  const errorFor = (field: string): string | undefined => {
    const code = fieldErrors[field];
    return code ? t(choreFieldErrorKey(field, code)) : undefined;
  };
  // Keeps a Category the list no longer offers selectable, so editing never silently changes it.
  const categoryIds = values.category && !categories.includes(values.category) ? [values.category, ...categories] : categories;
  const showSuggestion = suggestTwoPerson(values.baseEffort, values.people);

  /**
   * The aria attributes and the notes for one field, wired by id. A field with a hint gets the hint line as its
   * notes; its error line is shown by the group around it.
   */
  function field(name: string, hintKey?: MessageKey) {
    const error = errorFor(name);
    const hintId = hintKey && `${idPrefix}-${name}-hint`;
    const errorId = error && `${idPrefix}-${name}-error`;
    return {
      aria: {
        "aria-invalid": error ? (true as const) : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      },
      notes: hintKey ? (
        <p id={hintId} className="text-muted">
          {t(hintKey)}
        </p>
      ) : (
        error && (
          <p id={errorId} role="alert" className="text-danger">
            {error}
          </p>
        )
      ),
    };
  }

  function group(name: string, legendKey: MessageKey, children: ReactNode) {
    const { aria, notes } = field(name);
    return (
      <fieldset className="mt-4 p-0 border-0" disabled={saving} aria-describedby={aria["aria-describedby"]}>
        <legend className="font-semibold">{t(legendKey)}</legend>
        {children}
        {notes}
      </fieldset>
    );
  }

  const radioId = (groupName: string, value: number | string) => `${idPrefix}-${groupName}-${value}`;

  /** A row of radio buttons sharing one name; each input has an id so other controls can focus it. */
  function radios<V extends number | string>(
    groupName: string,
    options: RadioOption<V>[],
    selected: V,
    onSelect: (value: V) => void,
  ) {
    return (
      <div className="flex flex-wrap gap-x-4">
        {options.map((option) => (
          <label key={option.value} className={CHOICE}>
            <input
              id={radioId(groupName, option.value)}
              type="radio"
              name={`${idPrefix}-${groupName}`}
              className={CHECK}
              checked={selected === option.value}
              onChange={() => onSelect(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  const name = field("name");
  const category = field("category");
  const interval = field("intervalDays", "chores.form.intervalDays.hint");

  /** Picking a preset fills the days; the number typed under Custom is kept for when Custom is picked again. */
  function choosePreset(next: IntervalPreset) {
    if (preset === "custom") customText.current = values.intervalDays;
    setPreset(next);
    const days = intervalForPreset(next);
    form.change({ intervalDays: days === null ? customText.current : String(days) }, "intervalDays");
  }
  const buildsUp = field("buildsUp");

  const heading = t(mode === "edit" ? "chores.form.edit.heading" : "chores.form.create.heading");
  const formId = `${idPrefix}-form`;
  const submit = (
    <Button type="submit" form={formId} disabled={saving} aria-busy={saving}>
      {t(saving ? "chores.form.saving" : mode === "edit" ? "chores.form.submit.save" : "chores.form.submit.create")}
    </Button>
  );
  const cancel = (
    <Button variant="secondary" disabled={saving} onClick={onCancel}>
      {t("chores.form.cancel")}
    </Button>
  );

  const fields = (
    <form id={formId} onSubmit={form.submit} noValidate aria-busy={saving}>
      <div>
        <label htmlFor={`${idPrefix}-name`}>{t("chores.form.name.label")}</label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          autoComplete="off"
          value={values.name}
          disabled={saving}
          {...name.aria}
          onChange={(event) => form.change({ name: event.target.value }, "name")}
        />
        {name.notes}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-category`}>{t("chores.form.category.label")}</label>
        <select
          id={`${idPrefix}-category`}
          value={values.category}
          disabled={saving}
          {...category.aria}
          onChange={(event) => form.change({ category: event.target.value }, "category")}
        >
          <option value="">{t("chores.form.category.placeholder")}</option>
          {categoryIds.map((id) => (
            <option key={id} value={id}>
              {text(categoryLabel(id))}
            </option>
          ))}
        </select>
        {category.notes}
      </div>

      {group(
        "demands",
        "chores.form.demands.legend",
        demands.map((id) => (
          <label key={id} className={CHOICE}>
            <input
              type="checkbox"
              className={CHECK}
              checked={values.demands.includes(id)}
              onChange={() => form.change({ demands: toggled(values.demands, id) }, "demands")}
            />
            {text(demandLabel(id))}
          </label>
        )),
      )}

      {group(
        "baseEffort",
        "chores.form.baseEffort.legend",
        radios(
          "baseEffort",
          EFFORT_LEVELS.map((level) => ({ value: levelToEffort(level), label: t(effortLevelKey(level)) })),
          values.baseEffort,
          (baseEffort) => form.change({ baseEffort }, "baseEffort"),
        ),
      )}

      {group(
        "importance",
        "chores.form.importance.legend",
        radios(
          "importance",
          IMPORTANCES.map((id) => ({ value: id, label: text(importanceLabel(id)) })),
          values.importance,
          (importance) => form.change({ importance }, "importance"),
        ),
      )}

      {group(
        "people",
        "chores.form.people.legend",
        radios(
          "people",
          [
            { value: 1, label: t("chores.form.people.one") },
            { value: 2, label: t("chores.form.people.two") },
          ],
          values.people,
          (people) => form.change({ people }, "people"),
        ),
      )}

      {/* The region is always present so a screen reader announces the suggestion when it appears. */}
      <div role="status">{showSuggestion && <p>{t("chores.form.suggestion")}</p>}</div>
      {showSuggestion && (
        <Button
          variant="secondary"
          disabled={saving}
          onClick={() => {
            form.change({ people: 2 }, "people");
            document.getElementById(radioId("people", 2))?.focus();
          }}
        >
          {t("chores.form.suggestion.action")}
        </Button>
      )}

      {group(
        "intervalDays",
        "chores.form.interval.legend",
        <>
          {radios(
            "interval",
            [...INTERVAL_PRESETS, "custom" as const].map((id) => ({ value: id, label: t(`chores.interval.${id}`) })),
            preset,
            choosePreset,
          )}
          {preset === "custom" && (
            <div>
              <label htmlFor={`${idPrefix}-intervalDays`}>{t("chores.form.intervalDays.label")}</label>
              <input
                id={`${idPrefix}-intervalDays`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={values.intervalDays}
                {...interval.aria}
                onChange={(event) => form.change({ intervalDays: event.target.value }, "intervalDays")}
              />
              {interval.notes}
            </div>
          )}
        </>,
      )}

      {group(
        "allowedWeekdays",
        "chores.form.allowedWeekdays.legend",
        DISPLAY_WEEKDAYS.map((day) => {
          const wire = WEEKDAYS.indexOf(day);
          return (
            <label key={day} className={CHOICE}>
              <input
                type="checkbox"
                className={CHECK}
                checked={values.allowedWeekdays.includes(wire)}
                onChange={() => form.change({ allowedWeekdays: toggled(values.allowedWeekdays, wire) }, "allowedWeekdays")}
              />
              {weekdayLabel(day, locale)}
            </label>
          );
        }),
      )}

      <div>
        <label className={CHOICE}>
          <input
            type="checkbox"
            className={CHECK}
            checked={values.buildsUp}
            disabled={saving}
            {...buildsUp.aria}
            onChange={(event) => form.change({ buildsUp: event.target.checked }, "buildsUp")}
          />
          {t("chores.form.buildsUp.label")}
        </label>
        {buildsUp.notes}
      </div>

      {status.kind === "invalid" && (
        <p role="alert" className="text-danger">
          {t("chores.form.invalid.summary")}
        </p>
      )}
      {status.kind === "failed" && (
        <p role="alert" className="text-danger">
          {t(SAVE_FAILURE_KEY[status.reason])}
        </p>
      )}

      {!inDialog && (
        <ButtonRow className="mt-4">
          {submit}
          {cancel}
        </ButtonRow>
      )}
    </form>
  );

  if (inDialog) {
    return (
      <AppDialog
        size="sheet"
        title={heading}
        onDismiss={onCancel}
        dismissible={!saving}
        footer={
          <>
            {cancel}
            {submit}
          </>
        }
      >
        {fields}
      </AppDialog>
    );
  }

  return (
    <Card as="section" aria-labelledby={`${idPrefix}-heading`} className="mt-4">
      <h3 id={`${idPrefix}-heading`} ref={headingRef} tabIndex={-1}>
        {heading}
      </h3>
      {fields}
    </Card>
  );
}
