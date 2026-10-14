/** What the page needs to know about the device, read once from the browser. */
export interface PlatformEnv {
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone: only defined by iOS Safari. */
  standaloneFlag: boolean | undefined;
  displayModeStandalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export function readPlatformEnv(): PlatformEnv {
  return {
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standaloneFlag: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  };
}

/** iPhone, iPod and iPadOS (which reports as a touch-screen "MacIntel"). */
export function isIOS(env: PlatformEnv): boolean {
  if (/^(iPhone|iPod|iPad)/.test(env.platform)) return true;
  return env.platform === "MacIntel" && env.maxTouchPoints > 1;
}

/** True when launched from the Home Screen icon rather than a browser tab. */
export function isStandalone(env: PlatformEnv): boolean {
  return env.displayModeStandalone || env.standaloneFlag === true;
}

export type ReminderAvailability =
  /** The Enable reminders button can be shown. */
  | { kind: "available" }
  /** iOS in a browser tab: show the Add to Home Screen steps first. */
  | { kind: "needs-install" }
  /** The browser cannot do push at all. */
  | { kind: "unsupported" };

export function reminderAvailability(env: PlatformEnv): ReminderAvailability {
  if (isIOS(env) && !isStandalone(env)) return { kind: "needs-install" };
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) {
    return { kind: "unsupported" };
  }
  return { kind: "available" };
}
