import { Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  OUTDOOR_LIMITS,
  OUTDOOR_ROW_LABEL_KEYS,
  OUTDOOR_TYPES,
  outdoorRowShown,
  PET_LABEL_KEYS,
  PETS,
  ROOM_LABEL_KEYS,
  ROOM_LIMITS,
  ROOM_TYPES,
  withDayToggled,
  type AnswersState,
  type OutdoorType,
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

interface CountRowProps {
  id: string;
  label: string;
  /** Read by screen readers with the field: "From 0 to 10". */
  range: string;
  count: number;
  max: number;
  disabled: boolean;
  error: string | undefined;
  autoFocus?: boolean;
  /** `typed` is true when the Resident typed the number, false for the − and + buttons. */
  onSet(next: number, typed: boolean): void;
  onFocus?(): void;
  onBlur?(): void;
}

/** One counted thing, a room or an outdoor area: a label, − and + for the pointer, and the number field for everyone. */
function CountRow({ id, label, range, count, max, disabled, error, autoFocus, onSet, onFocus, onBlur }: CountRowProps) {
  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="mt-0 min-w-0 flex-1 basis-32 [overflow-wrap:anywhere]">
          {label}
        </label>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button type="button" aria-hidden="true" tabIndex={-1} className={STEP} disabled={disabled || count <= 0} onClick={() => onSet(count - 1, false)}>
            <Minus className="size-4" />
          </button>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={count}
            autoFocus={autoFocus}
            className="mt-0 w-14 border-transparent bg-transparent px-0 text-center text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-range ${id}-error` : `${id}-range`}
            onChange={(event) => onSet(clampCount(event.target.value, max), true)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <button type="button" aria-hidden="true" tabIndex={-1} className={STEP} disabled={disabled || count >= max} onClick={() => onSet(count + 1, false)}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <p id={`${id}-range`} className="sr-only">
        {range}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

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
  // The outdoor type whose number field has focus, so a row emptied by typing stays until the field is left.
  const [focusedOutdoor, setFocusedOutdoor] = useState<OutdoorType | null>(null);
  // The type just added from its chip: the chip unmounts, so the new row's field takes focus.
  const [justAdded, setJustAdded] = useState<OutdoorType | null>(null);

  const shownOutdoor = OUTDOOR_TYPES.filter((type) => outdoorRowShown(value.outdoor[type], focusedOutdoor === type));

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
          {ROOM_TYPES.map((type) => (
            <CountRow
              key={type}
              id={`${idPrefix}-rooms-${type}`}
              label={t(ROOM_LABEL_KEYS[type])}
              range={t("catalog.rooms.range", { max: ROOM_LIMITS[type] })}
              count={value.rooms[type]}
              max={ROOM_LIMITS[type]}
              disabled={disabled}
              error={errorText(`rooms.${type}`)}
              onSet={(next) => onChange({ ...value, rooms: { ...value.rooms, [type]: next } })}
            />
          ))}
          {shownOutdoor.map((type) => (
            <CountRow
              key={type}
              id={`${idPrefix}-outdoor-${type}`}
              label={t(OUTDOOR_ROW_LABEL_KEYS[type])}
              range={t("catalog.rooms.range", { max: OUTDOOR_LIMITS[type] })}
              count={value.outdoor[type]}
              max={OUTDOOR_LIMITS[type]}
              disabled={disabled}
              error={errorText(`outdoor.${type}`)}
              autoFocus={justAdded === type}
              onSet={(next, typed) => {
                // Stepping down to 0 removes the row now; typing 0 keeps it until the field loses focus.
                if (next === 0 && !typed) setFocusedOutdoor(null);
                onChange({ ...value, outdoor: { ...value.outdoor, [type]: next } });
              }}
              onFocus={() => setFocusedOutdoor(type)}
              onBlur={() => {
                setFocusedOutdoor(null);
                setJustAdded(null);
              }}
            />
          ))}
        </div>,
      )}

      {group(
        t("catalog.outdoor.legend"),
        [],
        <div className={CHIPS}>
          {OUTDOOR_TYPES.filter((type) => !shownOutdoor.includes(type)).map((type) => {
            const area = t(OUTDOOR_LABEL_KEYS[type]);
            return (
              <button
                key={type}
                type="button"
                className={`${CHIP} gap-2 disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted`}
                disabled={disabled}
                aria-label={t("catalog.outdoor.add", { area: area.toLocaleLowerCase(locale) })}
                onClick={() => {
                  setJustAdded(type);
                  onChange({ ...value, outdoor: { ...value.outdoor, [type]: 1 } });
                }}
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                {area}
              </button>
            );
          })}
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
