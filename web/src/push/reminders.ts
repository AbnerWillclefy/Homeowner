import type { SaveResult, SubscriptionJSON, VapidKeyResult } from "../api/push";
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
    subscribe(options: {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array<ArrayBuffer>;
    }): Promise<PushSubscriptionLike>;
  };
}

/** Everything the reminders flow touches in the browser and the API, so it can be tested without either. */
export interface RemindersDeps {
  getPermission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  getRegistration(): Promise<PushRegistrationLike>;
  getVapidPublicKey(): Promise<VapidKeyResult>;
  saveSubscription(sub: SubscriptionJSON, userAgent: string): Promise<SaveResult>;
  userAgent: string;
}

export type RemindersResult =
  | { kind: "enabled"; endpoint: string }
  /** The user (or iOS/Android settings) blocks notifications; the app cannot ask again. */
  | { kind: "denied" }
  /** The permission prompt was closed without an answer. */
  | { kind: "dismissed" }
  | { kind: "not-configured" }
  | { kind: "error" };

export type SyncResult = RemindersResult | { kind: "skipped" };

async function ensureSubscribed(deps: RemindersDeps): Promise<RemindersResult> {
  const vapid = await deps.getVapidPublicKey();
  if (vapid.kind === "not-configured") return { kind: "not-configured" };
  if (vapid.kind === "error") return { kind: "error" };

  const serverKey = base64UrlToBytes(vapid.key);
  const { pushManager } = await deps.getRegistration();

  let sub = await pushManager.getSubscription();
  // A subscription made with another key cannot receive our pushes; start over.
  if (sub?.options.applicationServerKey) {
    if (!bytesEqual(new Uint8Array(sub.options.applicationServerKey), serverKey)) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });

  const saved = await deps.saveSubscription(sub.toJSON(), deps.userAgent);
  return saved.kind === "ok" ? { kind: "enabled", endpoint: sub.endpoint } : { kind: "error" };
}

/** Call only from a button tap: it is the one place that asks for notification permission. */
export async function enableReminders(deps: RemindersDeps): Promise<RemindersResult> {
  try {
    let permission = deps.getPermission();
    if (permission === "default") permission = await deps.requestPermission();
    if (permission === "denied") return { kind: "denied" };
    if (permission !== "granted") return { kind: "dismissed" };
    return await ensureSubscribed(deps);
  } catch {
    return { kind: "error" };
  }
}

/** Runs on every launch. Never prompts; push is best-effort, so it never throws. */
export async function syncOnLaunch(deps: RemindersDeps): Promise<SyncResult> {
  if (deps.getPermission() !== "granted") return { kind: "skipped" };
  try {
    return await ensureSubscribed(deps);
  } catch {
    return { kind: "error" };
  }
}
