import { useMemo } from "react";
import type { Home } from "../api/home";
import { DEFAULT_ALLOCATION_TIME } from "./allocationTimes";
import { browserTimezone, browserTimezones } from "./browserTimezones";
import { createOrLoad } from "./createOrLoad";
import { HomeForm } from "./HomeForm";
import { defaultTimezone, timezoneOptions } from "./timezones";

interface Props {
  onSaved(home: Home): void;
  /** The person already had a Home, and it was loaded instead of a new one made. */
  onRecovered(home: Home): void;
}

const COPY = {
  heading: "home.create.heading",
  intro: "home.create.intro",
  submit: "home.create.submit",
  submitting: "home.create.submitting",
} as const;

/** For a signed-in User with no Home: pick a timezone and Allocation time, and become its first Resident. */
export function CreateHome({ onSaved, onRecovered }: Props) {
  const zones = useMemo(() => browserTimezones(), []);
  const options = useMemo(() => timezoneOptions(zones), [zones]);
  const initial = useMemo(
    () => ({ timezone: defaultTimezone(zones, browserTimezone()), allocationTime: DEFAULT_ALLOCATION_TIME }),
    [zones],
  );

  return (
    <HomeForm
      idPrefix="create-home"
      copy={COPY}
      initial={initial}
      timezones={options}
      save={createOrLoad}
      onSaved={onSaved}
      onRecovered={onRecovered}
    />
  );
}
