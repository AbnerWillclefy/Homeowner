import { useMemo } from "react";
import type { Home } from "../api/home";
import { browserTimezones } from "./browserTimezones";
import { saveSettings } from "./createOrLoad";
import { HomeForm } from "./HomeForm";
import { timezoneOptions } from "./timezones";

interface Props {
  home: Home;
  onSaved(home: Home): void;
}

const COPY = {
  heading: "home.settings.heading",
  submit: "home.settings.save",
  submitting: "home.settings.saving",
  saved: "home.settings.saved",
} as const;

/** A Resident's view of the Home's settings, editable by any Resident. */
export function HomeSettingsForm({ home, onSaved }: Props) {
  const options = useMemo(() => timezoneOptions(browserTimezones(), home.timezone), [home.timezone]);
  const initial = useMemo(
    () => ({ timezone: home.timezone, allocationTime: home.allocationTime }),
    [home.timezone, home.allocationTime],
  );

  return (
    <HomeForm
      idPrefix="home-settings"
      copy={COPY}
      initial={initial}
      timezones={options}
      save={saveSettings}
      onSaved={onSaved}
    />
  );
}
