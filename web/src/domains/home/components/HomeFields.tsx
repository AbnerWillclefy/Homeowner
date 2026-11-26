import { Select } from "@homeowner/bedrock";
import type { FieldCodes, HomeSettings } from "../api/api";
import { useI18n } from "../../../shared/i18n";
import { AllocationTimePicker } from "./AllocationTimePicker";
import { fieldErrorKey } from "../logic/fieldErrors";

interface Props {
  values: HomeSettings;
  timezones: readonly string[];
  fieldErrors: FieldCodes;
  disabled: boolean;
  onChange(field: keyof HomeSettings, value: string): void;
}

/** The two fields of a Home, the same for creating and editing: timezone and Allocation time. */
export function HomeFields({ values, timezones, fieldErrors, disabled, onChange }: Props) {
  const { t } = useI18n();

  function errorFor(field: keyof HomeSettings): string | undefined {
    const code = fieldErrors[field];
    return code ? t(fieldErrorKey(field, code)) : undefined;
  }

  return (
    <>
      <Select
        label={t("home.timezone.label")}
        error={errorFor("timezone")}
        value={values.timezone}
        disabled={disabled}
        options={timezones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
        onValueChange={(value) => onChange("timezone", value)}
      />
      <AllocationTimePicker
        label={t("home.allocationTime.label")}
        error={errorFor("allocationTime")}
        value={values.allocationTime}
        disabled={disabled}
        onChange={(value) => onChange("allocationTime", value)}
      />
    </>
  );
}
