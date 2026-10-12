import type { ReactNode } from "react";
import { WEEKDAYS } from "../profile/api";
import type { FieldCodes } from "../home/api";
import { useI18n } from "../shared/i18n";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../profile/weekdays";
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
} from "./answers";

const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-center gap-3 min-h-11 mt-0 font-normal";

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
  function group(legend: string, errorFields: string[], children: ReactNode) {
    const messages = errorFields.flatMap((field) => {
      const text = errorText(field);
      return text ? [{ field, text }] : [];
    });
    const describedBy = messages.map((m) => `${idPrefix}-${m.field}-error`).join(" ");
    return (
      <fieldset className="mt-4 p-0 border-0" disabled={disabled} aria-describedby={describedBy || undefined}>
        <legend className="font-semibold">{legend}</legend>
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
      <div className="flex flex-wrap gap-x-4">
        {DISPLAY_WEEKDAYS.map((day) => {
          const wire = WEEKDAYS.indexOf(day);
          return (
            <label key={day} className={CHOICE}>
              <input
                type="checkbox"
                className={CHECK}
                checked={value.collection[stream].includes(wire)}
                onChange={() =>
                  onChange({ ...value, collection: { ...value.collection, [stream]: withDayToggled(value.collection[stream], wire) } })
                }
              />
              {weekdayLabel(day, locale)}
            </label>
          );
        })}
      </div>,
    );
  }

  return (
    <>
      {group(
        t("catalog.rooms.legend"),
        [],
        ROOM_TYPES.map((type) => {
          const id = `${idPrefix}-rooms-${type}`;
          const error = errorText(`rooms.${type}`);
          return (
            <div key={type}>
              <label htmlFor={id}>{t(ROOM_LABEL_KEYS[type])}</label>
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={ROOM_LIMITS[type]}
                value={value.rooms[type]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-range ${id}-error` : `${id}-range`}
                onChange={(event) =>
                  onChange({ ...value, rooms: { ...value.rooms, [type]: clampCount(event.target.value, ROOM_LIMITS[type]) } })
                }
              />
              <p id={`${id}-range`} className="text-muted">
                {t("catalog.rooms.range", { max: ROOM_LIMITS[type] })}
              </p>
              {error && (
                <p id={`${id}-error`} className="text-danger">
                  {error}
                </p>
              )}
            </div>
          );
        }),
      )}

      {group(
        t("catalog.outdoor.legend"),
        ["outdoor"],
        <div className="flex flex-wrap gap-x-4">
          {OUTDOORS.map((id) => (
            <label key={id} className={CHOICE}>
              <input
                type="radio"
                name={`${idPrefix}-outdoor`}
                className={CHECK}
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
        <div className="flex flex-wrap gap-x-4">
          {PETS.map((id) => (
            <label key={id} className={CHOICE}>
              <input
                type="checkbox"
                className={CHECK}
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
            <div className="flex flex-wrap gap-x-4">
              {COOKINGS.map((id) => (
                <label key={id} className={CHOICE}>
                  <input
                    type="radio"
                    name={`${idPrefix}-cooking`}
                    className={CHECK}
                    checked={value.habits.cooking === id}
                    onChange={() => onChange({ ...value, habits: { ...value.habits, cooking: id } })}
                  />
                  {t(COOKING_LABEL_KEYS[id])}
                </label>
              ))}
            </div>,
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
