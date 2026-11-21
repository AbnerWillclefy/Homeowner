/** The sessionStorage key set when the User dismisses the install banner: it does not come back that session. */
export const INSTALL_DISMISSED_KEY = "revenue.install-dismissed";

export function isDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(INSTALL_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

export function rememberDismissed(): void {
  try {
    window.sessionStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  } catch {
    // Not remembered; the banner is gone until the next load.
  }
}

/** The event Chromium fires when the app can be installed. Not in lib.dom. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** iPhone and iPad have no `beforeinstallprompt`: the User adds the app from Safari's Share menu. False once installed. */
export function needsManualInstall(nav: Navigator & { standalone?: boolean }): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) && nav.standalone !== true;
}
