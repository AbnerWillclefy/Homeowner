import type { FieldCodes, HomeSettings } from "../api/home";
import { useI18n } from "../i18n";
import { ALLOCATION_TIMES, formatAllocationTime } from "./allocationTimes";
import { fieldErrorKey } from "./fieldErrors";

interface SelectFieldProps {
  id: string;
  label: string;
  /** The already-translated error, if the field has one. */
  error: string | undefined;
  value: string;
  disabled: boolean;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
}

/** A labelled select with an error, owning the id and aria wiring between them. */
function SelectField({ id, label, error, value, disabled, options, onChange }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

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

  function errorFor(field: keyof HomeSettings): string | undefined {
    const code = fieldErrors[field];
    return code ? t(fieldErrorKey(field, code)) : undefined;
  }

  return (
    <>
      <SelectField
        id={`${idPrefix}-timezone`}
        label={t("home.timezone.label")}
        error={errorFor("timezone")}
        value={values.timezone}
        disabled={disabled}
        options={timezones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        onChange={(value) => onChange("timezone", value)}
      />
      <SelectField
        id={`${idPrefix}-allocationTime`}
        label={t("home.allocationTime.label")}
        error={errorFor("allocationTime")}
        value={values.allocationTime}
        disabled={disabled}
        options={ALLOCATION_TIMES.map((time) => ({ value: time, label: formatAllocationTime(time, locale) }))}
        onChange={(value) => onChange("allocationTime", value)}
      />
    </>
  );
}
