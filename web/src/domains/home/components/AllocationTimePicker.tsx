import { Select } from "@homeowner/bedrock";
import { useMemo } from "react";
import { useI18n } from "../../../shared/i18n";
import { allocationTimeOptions } from "../logic/allocationTimes";

interface Props {
  /** "HH:MM", 24 hours. */
  value: string;
  onChange(value: string): void;
  label: string;
  /** The already-translated error, if there is one. */
  error?: string;
  disabled?: boolean;
  hint?: string;
}

/**
 * Picks an Allocation time from every 15-minute slot of the day. It knows nothing of the Home or of any write, so
 * creating a Home and editing one share it. A Bedrock `Select`: the list scrolls to the chosen time and typing
 * "07" jumps to it.
 */
export function AllocationTimePicker({ value, onChange, label, error, disabled, hint }: Props) {
  const { locale } = useI18n();
  const options = useMemo(() => allocationTimeOptions(locale, value), [locale, value]);
  return <Select label={label} options={options} value={value} onValueChange={onChange} error={error} hint={hint} disabled={disabled} />;
}
