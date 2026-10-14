import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { WEEKDAYS } from "../../profile/api/api";
import type { FieldCodes } from "../../home/api/api";
import { useI18n } from "../../../shared/i18n";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../../profile/logic/weekdays";
import {
  answerErrorKey,
  clampCount,
  COOKING_LABEL_KEYS,
  COOKINGS,
  OUTDOOR_LABEL_KEYS,
  OUTDOORS,
  PET_LABEL_KEYS,
  PETS,
  ROOM_LABEL_KEYS,
  ROOM_LIMITS,
  ROOM_TYPES,
  withDayToggled,
  type AnswersState,
} from "../logic/answers";

const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-center gap-3 min-h-11 mt-0 font-normal";

// A choice drawn as a pill around a hidden radio or checkbox, filled when picked. Wraps at large text sizes.
const CHIP =
  "relative mt-0 flex min-h-11 cursor-pointer items-center justify-center rounded-pill border border-border bg-surface-raised px-4 text-center font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed";
const CHIPS = "flex flex-wrap gap-2 mt-2";

// The round − and + beside a room count. Pointer-only: the number field itself takes the keyboard and screen readers.
const STEP =
  "flex size-11 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-raised text-text disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted";

interface Props {
  /** Names the element ids, so two questionnaires on a page never share one. */
  idPrefix: string;
  value: AnswersState;
  onChange(next: AnswersState): void;
  /** The API's field codes for the answers, keyed like `rooms.bathrooms`. */
  errors: FieldCodes;
  disabled: boolean;
}

/**
 * The questions about a Home that the Catalog turns into suggested Chores. Controlled: the parent owns the
 * answers, so the flow that mounts it (Create Home, later onboarding) keeps them across steps and failures.
 */
export function Questionnaire({ idPrefix, value, onChange, errors, disabled }: Props) {
  const { t, locale } = useI18n();

  const errorText = (field: string) => (errors[field] ? t(answerErrorKey(errors[field])) : undefined);

  /** A fieldset whose errors are read with its legend. */
  function group(legend: string, errorFields: string[], children: ReactNode, nested = false) {
    const messages = errorFields.flatMap((field) => {
      const text = errorText(field);
      return text ? [{ field, text }] : [];
    });
    const describedBy = messages.map((m) => `${idPrefix}-${m.field}-error`).join(" ");
    return (
      <fieldset
        className={`m-0 min-w-0 border-0 p-0 ${nested ? "mt-4" : "mt-8 first:mt-6"}`}
        disabled={disabled}
        aria-describedby={describedBy || undefined}
      >
        <legend className={nested ? "p-0 text-sm text-muted" : "p-0 text-lg font-semibold"}>{legend}</legend>
        {children}
        {messages.map((m) => (
          <p key={m.field} id={`${idPrefix}-${m.field}-error`} className="text-danger">
            {m.text}
          </p>
        ))}
      </fieldset>
    );
  }

  function days(stream: "trash" | "recycling") {
    const field = `collection.${stream}`;
    return group(
      t(`catalog.collection.${stream}`),
      [field],
      // Seven equal columns so the week never breaks one day onto its own line; at large text sizes (rem grows
      // with Dynamic Type) the columns drop to four before a day name stops fitting.
      <div className="@container mt-2">
        <div className="grid grid-cols-7 gap-1 @max-[17.5rem]:grid-cols-4">
          {DISPLAY_WEEKDAYS.map((day) => {
            const wire = WEEKDAYS.indexOf(day);
            return (
              <label key={day} className={`${CHIP} min-w-0 px-0 text-sm first-letter:uppercase`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  aria-label={weekdayLabel(day, locale)}
                  checked={value.collection[stream].includes(wire)}
                  onChange={() =>
                    onChange({ ...value, collection: { ...value.collection, [stream]: withDayToggled(value.collection[stream], wire) } })
                  }
                />
                <span aria-hidden="true">{weekdayLabel(day, locale, "short").replace(".", "")}</span>
              </label>
            );
          })}
        </div>
      </div>,
      true,
    );
  }

  return (
    <>
      {group(
        t("catalog.rooms.legend"),
        [],
        <div className="flex flex-col divide-y divide-border/30">
          {ROOM_TYPES.map((type) => {
            const id = `${idPrefix}-rooms-${type}`;
            const error = errorText(`rooms.${type}`);
            const count = value.rooms[type];
            const max = ROOM_LIMITS[type];
            const set = (next: number) => onChange({ ...value, rooms: { ...value.rooms, [type]: next } });
            return (
              <div key={type} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={id} className="mt-0 min-w-0 [overflow-wrap:anywhere]">
                    {t(ROOM_LABEL_KEYS[type])}
                  </label>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-hidden="true" tabIndex={-1} className={STEP} disabled={disabled || count <= 0} onClick={() => set(count - 1)}>
                      <Minus className="size-4" />
                    </button>
                    <input
                      id={id}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={max}
                      value={count}
                      className="mt-0 w-14 border-transparent bg-transparent px-0 text-center text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-range ${id}-error` : `${id}-range`}
                      onChange={(event) => set(clampCount(event.target.value, max))}
                    />
                    <button type="button" aria-hidden="true" tabIndex={-1} className={STEP} disabled={disabled || count >= max} onClick={() => set(count + 1)}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <p id={`${id}-range`} className="sr-only">
                  {t("catalog.rooms.range", { max })}
                </p>
                {error && (
                  <p id={`${id}-error`} className="text-danger">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>,
      )}

      {group(
        t("catalog.outdoor.legend"),
        ["outdoor"],
        <div className={CHIPS}>
          {OUTDOORS.map((id) => (
            <label key={id} className={CHIP}>
              <input
                type="radio"
                name={`${idPrefix}-outdoor`}
                className="sr-only"
                checked={value.outdoor === id}
                onChange={() => onChange({ ...value, outdoor: id })}
              />
              {t(OUTDOOR_LABEL_KEYS[id])}
            </label>
          ))}
        </div>,
      )}

      {group(
        t("catalog.pets.legend"),
        ["pets"],
        <div className={CHIPS}>
          {PETS.map((id) => (
            <label key={id} className={CHIP}>
              <input
                type="checkbox"
                className="sr-only"
                checked={value.pets.includes(id)}
                onChange={() =>
                  onChange({ ...value, pets: value.pets.includes(id) ? value.pets.filter((p) => p !== id) : [...value.pets, id] })
                }
              />
              {t(PET_LABEL_KEYS[id])}
            </label>
          ))}
        </div>,
      )}

      {group(t("catalog.collection.legend"), [], (
        <>
          {days("trash")}
          {days("recycling")}
        </>
      ))}

      {group(
        t("catalog.habits.legend"),
        [],
        <>
          {group(
            t("catalog.habits.cooking.legend"),
            ["habits.cooking"],
            <div className={CHIPS}>
              {COOKINGS.map((id) => (
                <label key={id} className={CHIP}>
                  <input
                    type="radio"
                    name={`${idPrefix}-cooking`}
                    className="sr-only"
                    checked={value.habits.cooking === id}
                    onChange={() => onChange({ ...value, habits: { ...value.habits, cooking: id } })}
                  />
                  {t(COOKING_LABEL_KEYS[id])}
                </label>
              ))}
            </div>,
            true,
          )}
          <label className={CHOICE}>
            <input
              type="checkbox"
              className={CHECK}
              checked={value.habits.dishwasher}
              onChange={(event) => onChange({ ...value, habits: { ...value.habits, dishwasher: event.target.checked } })}
            />
            {t("catalog.habits.dishwasher")}
          </label>
          <label className={CHOICE}>
            <input
              type="checkbox"
              className={CHECK}
              checked={value.habits.washingMachine}
              onChange={(event) => onChange({ ...value, habits: { ...value.habits, washingMachine: event.target.checked } })}
            />
            {t("catalog.habits.washingMachine")}
          </label>
        </>,
      )}
    </>
  );
}
