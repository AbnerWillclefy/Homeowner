import type { PushWriteResult, SubscriptionJSON, VapidKeyResult } from "../api";
import { base64UrlToBytes, bytesEqual } from "./vapidKey";

export interface PushSubscriptionLike {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON(): SubscriptionJSON;
  unsubscribe(): Promise<boolean>;
}

export interface PushRegistrationLike {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }): Promise<PushSubscriptionLike>;
  };
}

/** Everything the notifications flow touches in the browser and the API, so it can be tested without either. */
export interface RemindersDeps {
  getPermission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  /** Revenue's own service worker registration (it is the only one on this origin). */
  getRegistration(): Promise<PushRegistrationLike>;
  getVapidPublicKey(): Promise<VapidKeyResult>;
  saveSubscription(sub: SubscriptionJSON, userAgent: string): Promise<PushWriteResult>;
  deleteSubscription(endpoint: string): Promise<PushWriteResult>;
  userAgent: string;
}

export type RemindersResult =
  | { kind: "enabled"; endpoint: string }
  /** Notifications are blocked in the browser or system; the app cannot ask again. */
  | { kind: "denied" }
  /** The permission prompt was closed without an answer. */
  | { kind: "dismissed" }
  | { kind: "not-configured" }
  /** The session ended. The browser part worked; sign in and try again. */
  | { kind: "not-signed-in" }
  /** The API did not answer, or rejected the request. The browser part worked. */
  | { kind: "error" }
  /** A browser call threw. `name` is the error's name (for example AbortError), never its message. */
  | { kind: "browser-error"; name: string };

export type SyncResult = RemindersResult | { kind: "skipped" };
export type DisableResult = { kind: "disabled" } | Exclude<RemindersResult, { kind: "enabled" | "denied" | "dismissed" | "not-configured" }>;

function errorName(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = (err as { name: unknown }).name;
    if (typeof name === "string" && name !== "") return name;
  }
  return "unknown";
}

type BrowserOutcome<T> = { ok: true; value: T } | { ok: false; result: { kind: "browser-error"; name: string } };

/** Wraps browser calls only. Keeps the full error in the console and carries just its name. */
async function inBrowser<T>(run: () => Promise<T>): Promise<BrowserOutcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    console.error("Notifications: a browser call failed", err);
    return { ok: false, result: { kind: "browser-error", name: errorName(err) } };
  }
}

async function ensureSubscribed(deps: RemindersDeps): Promise<RemindersResult> {
  const vapid = await deps.getVapidPublicKey();
  if (vapid.kind === "not-configured") return { kind: "not-configured" };
  if (vapid.kind === "error") return { kind: "error" };

  const subscribed = await inBrowser(async () => {
    const serverKey = base64UrlToBytes(vapid.key);
    const { pushManager } = await deps.getRegistration();
    let sub = await pushManager.getSubscription();
    // A subscription made with another key cannot receive our pushes; start over.
    if (sub?.options.applicationServerKey && !bytesEqual(new Uint8Array(sub.options.applicationServerKey), serverKey)) {
      await sub.unsubscribe();
      sub = null;
    }
    return sub ?? (await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey }));
  });
  if (!subscribed.ok) return subscribed.result;

  const saved = await deps.saveSubscription(subscribed.value.toJSON(), deps.userAgent);
  if (saved.kind === "not-signed-in") return saved;
  return saved.kind === "ok" ? { kind: "enabled", endpoint: subscribed.value.endpoint } : { kind: "error" };
}

/** Call only from the switch being turned on: it is the one place that asks for notification permission. */
export async function enableReminders(deps: RemindersDeps): Promise<RemindersResult> {
  let permission = deps.getPermission();
  if (permission === "default") {
    const asked = await inBrowser(() => deps.requestPermission());
    if (!asked.ok) return asked.result;
    permission = asked.value;
  }
  if (permission === "denied") return { kind: "denied" };
  if (permission !== "granted") return { kind: "dismissed" };
  return ensureSubscribed(deps);
}

/** The endpoint this device is registered with, or null (never subscribed, or turned off). Never prompts. */
export async function currentEndpoint(deps: RemindersDeps): Promise<string | null> {
  if (deps.getPermission() !== "granted") return null;
  const found = await inBrowser(async () => (await (await deps.getRegistration()).pushManager.getSubscription())?.endpoint ?? null);
  return found.ok ? found.value : null;
}

/**
 * Runs on every launch. Never prompts and never subscribes a device that turned notifications off (permission stays
 * granted after that, but there is no subscription): it only renews one that exists. Never throws.
 */
export async function syncOnLaunch(deps: RemindersDeps): Promise<SyncResult> {
  if ((await currentEndpoint(deps)) === null) return { kind: "skipped" };
  return ensureSubscribed(deps);
}

/** Turning off: unsubscribe in the browser, then DELETE the registration, so nothing stays registered on the server. */
export async function disableReminders(deps: RemindersDeps): Promise<DisableResult> {
  const removed = await inBrowser(async () => {
    const sub = await (await deps.getRegistration()).pushManager.getSubscription();
    if (!sub) return null;
    await sub.unsubscribe();
    return sub.endpoint;
  });
  if (!removed.ok) return removed.result;
  if (removed.value === null) return { kind: "disabled" };
  const result = await deps.deleteSubscription(removed.value);
  return result.kind === "ok" ? { kind: "disabled" } : result;
}
