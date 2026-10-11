import { useCallback, useEffect, useMemo, useState } from "react";
import { sendTestNotification, type TestResult } from "../api/push";
import { browserRemindersDeps } from "./browserDeps";
import { isIOS, readPlatformEnv, reminderAvailability, type ReminderAvailability } from "./platform";
import { enableReminders, syncOnLaunch, type RemindersResult } from "./reminders";

export type RemindersState =
  | { kind: "off" }
  | { kind: "working" }
  | { kind: "on"; endpoint: string }
  | { kind: "problem"; reason: Exclude<RemindersResult["kind"], "enabled"> };

export type TestState = { kind: "idle" } | { kind: "sending" } | { kind: "done"; result: TestResult };

export function usePush() {
  const env = useMemo(readPlatformEnv, []);
  const availability: ReminderAvailability = reminderAvailability(env);
  const ios = isIOS(env);
  const [reminders, setReminders] = useState<RemindersState>({ kind: "off" });
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  // Re-subscribe on every launch. This never prompts; failures are only logged.
  useEffect(() => {
    if (availability.kind !== "available") return;
    let cancelled = false;
    syncOnLaunch(browserRemindersDeps()).then((result) => {
      if (cancelled) return;
      if (result.kind === "enabled") setReminders({ kind: "on", endpoint: result.endpoint });
      else if (result.kind !== "skipped") console.warn(`Could not refresh reminders on launch: ${result.kind}`);
    });
    return () => {
      cancelled = true;
    };
  }, [availability.kind]);

  const enable = useCallback(async () => {
    setReminders({ kind: "working" });
    setTest({ kind: "idle" });
    const result = await enableReminders(browserRemindersDeps());
    setReminders(
      result.kind === "enabled" ? { kind: "on", endpoint: result.endpoint } : { kind: "problem", reason: result.kind },
    );
  }, []);

  const sendTest = useCallback(async () => {
    if (reminders.kind !== "on") return;
    setTest({ kind: "sending" });
    const result = await sendTestNotification(reminders.endpoint);
    setTest({ kind: "done", result });
    // The push service dropped this device; offer to enable again.
    if (result.kind === "gone" || result.kind === "unknown") setReminders({ kind: "off" });
  }, [reminders]);

  return { availability, ios, reminders, enable, test, sendTest };
}
