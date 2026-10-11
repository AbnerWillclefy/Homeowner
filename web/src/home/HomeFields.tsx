import type { FieldCodes, HomeSettings } from "../api/home";
import { useI18n } from "../i18n";
import { ALLOCATION_TIMES, formatAllocationTime } from "./allocationTimes";
import { fieldErrorKey } from "./fieldErrors";

interface Props {
  /** Prefix for element ids, so two forms on a page never share one. */
  idPrefix: string;
  values: HomeSettings;
  timezones: readonly string[];
  fieldErrors: FieldCodes;
  disabled: boolean;
  onChange(field: keyof HomeSettings, value: string): void;
}

/** The two fields of a Home, the same for creating and editing: timezone and Allocation time. */
export function HomeFields({ idPrefix, values, timezones, fieldErrors, disabled, onChange }: Props) {
  const { t, locale } = useI18n();

  function describedBy(field: keyof HomeSettings): string {
    return fieldErrors[field] ? `${idPrefix}-${field}-hint ${idPrefix}-${field}-error` : `${idPrefix}-${field}-hint`;
  }

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-timezone`}>{t("home.timezone.label")}</label>
        <select
          id={`${idPrefix}-timezone`}
          value={values.timezone}
          disabled={disabled}
          aria-invalid={fieldErrors.timezone ? true : undefined}
          aria-describedby={describedBy("timezone")}
          onChange={(event) => onChange("timezone", event.target.value)}
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p id={`${idPrefix}-timezone-hint`} className="text-muted">
          {t("home.timezone.hint")}
        </p>
        {fieldErrors.timezone && (
          <p id={`${idPrefix}-timezone-error`} className="text-danger">
            {t(fieldErrorKey("timezone", fieldErrors.timezone))}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-allocationTime`}>{t("home.allocationTime.label")}</label>
        <select
          id={`${idPrefix}-allocationTime`}
          value={values.allocationTime}
          disabled={disabled}
          aria-invalid={fieldErrors.allocationTime ? true : undefined}
          aria-describedby={describedBy("allocationTime")}
          onChange={(event) => onChange("allocationTime", event.target.value)}
        >
          {ALLOCATION_TIMES.map((time) => (
            <option key={time} value={time}>
              {formatAllocationTime(time, locale)}
            </option>
          ))}
        </select>
        <p id={`${idPrefix}-allocationTime-hint`} className="text-muted">
          {t("home.allocationTime.hint")}
        </p>
        {fieldErrors.allocationTime && (
          <p id={`${idPrefix}-allocationTime-error`} className="text-danger">
            {t(fieldErrorKey("allocationTime", fieldErrors.allocationTime))}
          </p>
        )}
      </div>
    </>
  );
}
