import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { browserRemindersDeps } from "../logic/browserDeps";
import { isIOS, readPlatformEnv, reminderAvailability, type ReminderAvailability } from "../logic/platform";
import type { RemindersProblem } from "../logic/problemText";
import { launchSyncGate, LAUNCH_SYNC_FALLBACK_MS, type LaunchSyncGate } from "../logic/launchSyncGate";
import { enableReminders, syncOnLaunch } from "../logic/reminders";

export type RemindersState =
  | { kind: "off" }
  | { kind: "working" }
  | { kind: "on"; endpoint: string }
  | { kind: "problem"; problem: RemindersProblem };

/**
 * Only mounted while signed in (see App), so nothing here calls a protected route when signed out. The launch
 * re-subscribe waits until the first page load has settled (`markPageSettled`), or `LAUNCH_SYNC_FALLBACK_MS` if no
 * page reports it, so reminder setup never competes with the first screen. `enable` never waits.
 */
export function usePush() {
  const env = useMemo(readPlatformEnv, []);
  const availability: ReminderAvailability = reminderAvailability(env);
  const ios = isIOS(env);
  const [reminders, setReminders] = useState<RemindersState>({ kind: "off" });

  const gate = useRef<LaunchSyncGate | null>(null);
  /** The first page load settled (data or failure). Only the first call matters; the gate ignores the rest. */
  const markPageSettled = useCallback(() => gate.current?.settled(), []);

  // Re-subscribe on every launch, after the first page load settles. This never prompts; failures are only logged.
  useEffect(() => {
    if (availability.kind !== "available") return;
    let cancelled = false;
    const launch = launchSyncGate(LAUNCH_SYNC_FALLBACK_MS, () => {
      syncOnLaunch(browserRemindersDeps()).then((result) => {
        if (cancelled) return;
        if (result.kind === "enabled") setReminders({ kind: "on", endpoint: result.endpoint });
        else if (result.kind !== "skipped") {
          // Launch never alerts; the original error was already logged by syncOnLaunch.
          const detail = result.kind === "browser-error" ? `${result.kind} (${result.name})` : result.kind;
          console.warn(`Could not refresh reminders on launch: ${detail}`);
        }
      });
    });
    gate.current = launch;
    return () => {
      cancelled = true;
      launch.dispose();
      gate.current = null;
    };
  }, [availability.kind]);

  // Guarded in the handler: a double tap must not ask for permission or subscribe twice.
  const { run: enable } = useSubmitOnce(async () => {
    setReminders({ kind: "working" });
    const result = await enableReminders(browserRemindersDeps());
    setReminders(
      result.kind === "enabled" ? { kind: "on", endpoint: result.endpoint } : { kind: "problem", problem: result },
    );
  });

  return { availability, ios, reminders, enable, markPageSettled };
}
