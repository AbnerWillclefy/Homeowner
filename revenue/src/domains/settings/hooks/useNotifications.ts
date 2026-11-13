import { useCallback, useEffect, useMemo, useState } from "react";
import { browserRemindersDeps } from "../logic/browserDeps";
import { readPlatformEnv, reminderAvailability, type ReminderAvailability } from "../logic/platform";
import type { RemindersProblem } from "../logic/problemText";
import { currentEndpoint, disableReminders, enableReminders, syncOnLaunch } from "../logic/reminders";

/** Re-subscribes silently on every launch (never prompts, never subscribes a device that turned notifications off). Mount once, signed in. */
export function useSyncOnLaunch() {
  const available = useMemo(() => reminderAvailability(readPlatformEnv()).kind === "available", []);
  useEffect(() => {
    if (!available) return;
    void syncOnLaunch(browserRemindersDeps()).then((result) => {
      if (result.kind !== "enabled" && result.kind !== "skipped") console.warn(`Could not refresh notifications on launch: ${result.kind}`);
    });
  }, [available]);
}

export type NotificationsState = { kind: "off" } | { kind: "working" } | { kind: "on" } | { kind: "problem"; problem: RemindersProblem };

/** The notifications switch: off until the User turns it on; the permission is asked only then. */
export function useNotifications() {
  const env = useMemo(readPlatformEnv, []);
  const availability: ReminderAvailability = reminderAvailability(env);
  const [state, setState] = useState<NotificationsState>({ kind: "off" });

  // Reflects what this device is registered for. Never prompts.
  useEffect(() => {
    if (availability.kind !== "available") return;
    let cancelled = false;
    void currentEndpoint(browserRemindersDeps()).then((endpoint) => {
      if (!cancelled && endpoint !== null) setState((now) => (now.kind === "off" ? { kind: "on" } : now));
    });
    return () => {
      cancelled = true;
    };
  }, [availability.kind]);

  const turn = useCallback(async (on: boolean) => {
    setState((now) => (now.kind === "working" ? now : { kind: "working" }));
    const deps = browserRemindersDeps();
    if (on) {
      const result = await enableReminders(deps);
      setState(result.kind === "enabled" ? { kind: "on" } : { kind: "problem", problem: result });
    } else {
      const result = await disableReminders(deps);
      setState(result.kind === "disabled" ? { kind: "off" } : { kind: "problem", problem: result });
    }
  }, []);

  return { availability, state, turn };
}
