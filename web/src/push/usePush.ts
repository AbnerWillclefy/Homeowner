import { useCallback, useEffect, useMemo, useState } from "react";
import { browserRemindersDeps } from "./browserDeps";
import { isIOS, readPlatformEnv, reminderAvailability, type ReminderAvailability } from "./platform";
import type { RemindersProblem } from "./problemText";
import { enableReminders, syncOnLaunch } from "./reminders";

export type RemindersState =
  | { kind: "off" }
  | { kind: "working" }
  | { kind: "on"; endpoint: string }
  | { kind: "problem"; problem: RemindersProblem };

/** Only mounted while signed in (see App), so nothing here calls a protected route when signed out. */
export function usePush() {
  const env = useMemo(readPlatformEnv, []);
  const availability: ReminderAvailability = reminderAvailability(env);
  const ios = isIOS(env);
  const [reminders, setReminders] = useState<RemindersState>({ kind: "off" });

  // Re-subscribe on every launch. This never prompts; failures are only logged.
  useEffect(() => {
    if (availability.kind !== "available") return;
    let cancelled = false;
    syncOnLaunch(browserRemindersDeps()).then((result) => {
      if (cancelled) return;
      if (result.kind === "enabled") setReminders({ kind: "on", endpoint: result.endpoint });
      else if (result.kind !== "skipped") {
        // Launch never alerts; the original error was already logged by syncOnLaunch.
        const detail = result.kind === "browser-error" ? `${result.kind} (${result.name})` : result.kind;
        console.warn(`Could not refresh reminders on launch: ${detail}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [availability.kind]);

  const enable = useCallback(async () => {
    setReminders({ kind: "working" });
    const result = await enableReminders(browserRemindersDeps());
    setReminders(
      result.kind === "enabled" ? { kind: "on", endpoint: result.endpoint } : { kind: "problem", problem: result },
    );
  }, []);

  return { availability, ios, reminders, enable };
}
