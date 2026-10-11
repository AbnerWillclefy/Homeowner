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
  /** The API did not answer, or rejected the request. The browser part worked. */
  | { kind: "error" }
  /** A browser call threw. `name` is the error's name (for example AbortError), never its message. */
  | { kind: "browser-error"; name: string };

export type SyncResult = RemindersResult | { kind: "skipped" };

/** The name of a thrown value, read defensively: a DOMException is not an Error in every environment. */
function errorName(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = (err as { name: unknown }).name;
    if (typeof name === "string" && name !== "") return name;
  }
  return "unknown";
}

type BrowserOutcome<T> = { ok: true; value: T } | { ok: false; result: RemindersResult };

/** Wraps browser calls only. Keeps the full error in the console and carries just its name. */
async function inBrowser<T>(run: () => Promise<T>): Promise<BrowserOutcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    console.error("Reminders: a browser call failed", err);
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
    if (sub?.options.applicationServerKey) {
      if (!bytesEqual(new Uint8Array(sub.options.applicationServerKey), serverKey)) {
        await sub.unsubscribe();
        sub = null;
      }
    }
    return sub ?? (await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey }));
  });
  if (!subscribed.ok) return subscribed.result;

  const sub = subscribed.value;
  const saved = await deps.saveSubscription(sub.toJSON(), deps.userAgent);
  return saved.kind === "ok" ? { kind: "enabled", endpoint: sub.endpoint } : { kind: "error" };
}

/** Call only from a button tap: it is the one place that asks for notification permission. */
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

/** Runs on every launch. Never prompts; push is best-effort, so it never throws. */
export async function syncOnLaunch(deps: RemindersDeps): Promise<SyncResult> {
  if (deps.getPermission() !== "granted") return { kind: "skipped" };
  return ensureSubscribed(deps);
}
