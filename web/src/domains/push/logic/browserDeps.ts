import { getVapidPublicKey, saveSubscription } from "../api/api";
import type { PushRegistrationLike, RemindersDeps } from "./reminders";

/** The real browser and API behind RemindersDeps. Call only when push is supported. */
export function browserRemindersDeps(): RemindersDeps {
  return {
    getPermission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    getRegistration: async () => (await navigator.serviceWorker.ready) as unknown as PushRegistrationLike,
    getVapidPublicKey,
    saveSubscription,
    userAgent: navigator.userAgent,
  };
}
