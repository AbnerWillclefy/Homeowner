import { useEffect, useRef, type ReactNode } from "react";
import type { Chore, ChoreInput, SaveChoreResult } from "../api/chores";
import { WEEKDAYS } from "../api/profile";
import { useI18n, type MessageKey } from "../i18n";
import { categoryLabel, demandLabel, importanceLabel, type Label } from "../profile/labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../profile/weekdays";
import { choreFieldErrorKey } from "./fieldErrors";
import { SAVE_FAILURE_KEY } from "./failureMessages";
import { toggled, type ChoreFormState } from "./form";
import { suggestTwoPerson } from "./suggestion";
import { useChoreForm } from "./useChoreForm";

const EFFORTS = [1, 2, 3, 4, 5];
const IMPORTANCES = ["essential", "normal", "nice_to_have"];
const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-center gap-3 min-h-11 mt-0 font-normal";

interface Props {
  /** The Chore being edited, or null for a new one. */
  chore: Chore | null;
  initial: ChoreFormState;
  categories: readonly string[];
  demands: readonly string[];
  save(input: ChoreInput): Promise<SaveChoreResult>;
  onSaved(chore: Chore): void;
  onCancel(): void;
}

/** The create and edit form for a Chore: every field, the API's field errors beside their controls. */
export function ChoreForm({ chore, initial, categories, demands, save, onSaved, onCancel }: Props) {
  const { t, locale } = useI18n();
  const form = useChoreForm(initial, save, onSaved);
  const { values, status } = form;
  const saving = status.kind === "saving";
  const fieldErrors = status.kind === "invalid" ? status.fields : {};
  const idPrefix = `chore-form-${chore?.id ?? "new"}`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const twoPeopleRef = useRef<HTMLInputElement>(null);

  // The form appears in place of a button, so move the reader to it.
  useEffect(() => headingRef.current?.focus(), []);

  const text = (label: Label) => ("key" in label ? t(label.key) : label.text);
  const errorFor = (field: string): string | undefined => {
    const code = fieldErrors[field];
    return code ? t(choreFieldErrorKey(field, code)) : undefined;
  };
  // Keeps a Category the list no longer offers selectable, so editing never silently changes it.
  const categoryIds = values.category && !categories.includes(values.category) ? [values.category, ...categories] : categories;
  const showSuggestion = suggestTwoPerson(values.baseEffort, values.people);

  /** The aria attributes and the error line for one field, wired by id. */
  function field(name: string, hintKey?: MessageKey) {
    const error = errorFor(name);
    const ids = [hintKey ? `${idPrefix}-${name}-hint` : null, error ? `${idPrefix}-${name}-error` : null].filter(Boolean);
    return {
      aria: {
        "aria-invalid": error ? (true as const) : undefined,
        "aria-describedby": ids.length > 0 ? ids.join(" ") : undefined,
      },
      notes: (
        <>
          {hintKey && (
            <p id={`${idPrefix}-${name}-hint`} className="text-muted">
              {t(hintKey)}
            </p>
          )}
          {error && (
            <p id={`${idPrefix}-${name}-error`} className="text-danger">
              {error}
            </p>
          )}
        </>
      ),
    };
  }

  function group(name: string, legendKey: MessageKey, hintKey: MessageKey, children: ReactNode) {
    const { aria, notes } = field(name, hintKey);
    return (
      <fieldset className="mt-4 p-0 border-0" disabled={saving} aria-describedby={aria["aria-describedby"]}>
        <legend className="font-semibold">{t(legendKey)}</legend>
        {children}
        {notes}
      </fieldset>
    );
  }

  const name = field("name", "chores.form.name.hint");
  const category = field("category", "chores.form.category.hint");
  const interval = field("intervalDays", "chores.form.intervalDays.hint");
  const buildsUp = field("buildsUp", "chores.form.buildsUp.hint");

  return (
    <section aria-labelledby={`${idPrefix}-heading`}>
      <h3 id={`${idPrefix}-heading`} ref={headingRef} tabIndex={-1}>
        {t(chore ? "chores.form.edit.heading" : "chores.form.create.heading")}
      </h3>
      <form onSubmit={form.submit} noValidate>
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
          "chores.form.demands.hint",
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
          "chores.form.baseEffort.hint",
          <div className="flex flex-wrap gap-x-4">
            {EFFORTS.map((effort) => (
              <label key={effort} className={CHOICE}>
                <input
                  type="radio"
                  name={`${idPrefix}-baseEffort`}
                  className={CHECK}
                  checked={values.baseEffort === effort}
                  onChange={() => form.change({ baseEffort: effort }, "baseEffort")}
                />
                {t("chores.form.baseEffort.option", { effort })}
              </label>
            ))}
          </div>,
        )}

        {group(
          "importance",
          "chores.form.importance.legend",
          "chores.form.importance.hint",
          <div className="flex flex-wrap gap-x-4">
            {IMPORTANCES.map((id) => (
              <label key={id} className={CHOICE}>
                <input
                  type="radio"
                  name={`${idPrefix}-importance`}
                  className={CHECK}
                  checked={values.importance === id}
                  onChange={() => form.change({ importance: id }, "importance")}
                />
                {text(importanceLabel(id))}
              </label>
            ))}
          </div>,
        )}

        {group(
          "people",
          "chores.form.people.legend",
          "chores.form.people.hint",
          <div className="flex flex-wrap gap-x-4">
            <label className={CHOICE}>
              <input
                type="radio"
                name={`${idPrefix}-people`}
                className={CHECK}
                checked={values.people === 1}
                onChange={() => form.change({ people: 1 }, "people")}
              />
              {t("chores.form.people.one")}
            </label>
            <label className={CHOICE}>
              <input
                ref={twoPeopleRef}
                type="radio"
                name={`${idPrefix}-people`}
                className={CHECK}
                checked={values.people === 2}
                onChange={() => form.change({ people: 2 }, "people")}
              />
              {t("chores.form.people.two")}
            </label>
          </div>,
        )}

        {/* The region is always present so a screen reader announces the suggestion when it appears. */}
        <div role="status">{showSuggestion && <p>{t("chores.form.suggestion")}</p>}</div>
        {showSuggestion && (
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={() => {
              form.change({ people: 2 }, "people");
              twoPeopleRef.current?.focus();
            }}
          >
            {t("chores.form.suggestion.action")}
          </button>
        )}

        <div>
          <label htmlFor={`${idPrefix}-intervalDays`}>{t("chores.form.intervalDays.label")}</label>
          <input
            id={`${idPrefix}-intervalDays`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.intervalDays}
            disabled={saving}
            {...interval.aria}
            onChange={(event) => form.change({ intervalDays: event.target.value }, "intervalDays")}
          />
          {interval.notes}
        </div>

        {group(
          "allowedWeekdays",
          "chores.form.allowedWeekdays.legend",
          "chores.form.allowedWeekdays.hint",
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

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {t(saving ? "chores.form.saving" : chore ? "chores.form.submit.save" : "chores.form.submit.create")}
        </button>
        <button type="button" className="btn" disabled={saving} onClick={onCancel}>
          {t("chores.form.cancel")}
        </button>
      </form>
    </section>
  );
}
