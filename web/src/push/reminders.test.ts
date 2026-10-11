import { describe, expect, it, vi } from "vitest";
import type { SaveResult, SubscriptionJSON, VapidKeyResult } from "../api/push";
import { enableReminders, syncOnLaunch, type PushSubscriptionLike, type RemindersDeps } from "./reminders";

// "AQID" is bytes 1,2,3 and "BAUG" is bytes 4,5,6.
const KEY = "AQID";
const OTHER_KEY = "BAUG";

function fakeSub(endpoint: string, keyBytes: number[] | null): PushSubscriptionLike & { unsubscribe: ReturnType<typeof vi.fn> } {
  const json: SubscriptionJSON = { endpoint, keys: { p256dh: "pk", auth: "au" } };
  return {
    endpoint,
    options: { applicationServerKey: keyBytes ? new Uint8Array(keyBytes).buffer : null },
    toJSON: () => json,
    unsubscribe: vi.fn(async () => true),
  };
}

interface Setup {
  permission?: NotificationPermission;
  requested?: NotificationPermission;
  existing?: PushSubscriptionLike | null;
  vapid?: VapidKeyResult;
  save?: SaveResult;
}

function setup(o: Setup = {}) {
  const created = fakeSub("https://push.example/new", [1, 2, 3]);
  const subscribe = vi.fn(async (_opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }) => created);
  const requestPermission = vi.fn(async () => o.requested ?? "granted");
  const saveSubscription = vi.fn(async (_sub: SubscriptionJSON, _ua: string) => o.save ?? { kind: "ok" as const });
  const deps: RemindersDeps = {
    getPermission: () => o.permission ?? "default",
    requestPermission,
    getRegistration: async () => ({
      pushManager: { getSubscription: async () => o.existing ?? null, subscribe },
    }),
    getVapidPublicKey: async () => o.vapid ?? { kind: "ok", key: KEY },
    saveSubscription,
    userAgent: "TestAgent/1",
  };
  return { deps, subscribe, requestPermission, saveSubscription, created };
}

describe("enableReminders", () => {
  it("asks permission, subscribes with the API's key and saves the subscription", async () => {
    const t = setup();
    const result = await enableReminders(t.deps);
    expect(result).toEqual({ kind: "enabled", endpoint: "https://push.example/new" });
    expect(t.requestPermission).toHaveBeenCalledOnce();
    const opts = t.subscribe.mock.calls[0]![0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(Array.from(opts.applicationServerKey)).toEqual([1, 2, 3]);
    expect(t.saveSubscription).toHaveBeenCalledWith(t.created.toJSON(), "TestAgent/1");
  });

  it("reports denied without subscribing, and does not prompt again when already denied", async () => {
    const asked = setup({ requested: "denied" });
    expect(await enableReminders(asked.deps)).toEqual({ kind: "denied" });
    expect(asked.subscribe).not.toHaveBeenCalled();

    const already = setup({ permission: "denied" });
    expect(await enableReminders(already.deps)).toEqual({ kind: "denied" });
    expect(already.requestPermission).not.toHaveBeenCalled();
  });

  it("reports a dismissed prompt", async () => {
    const t = setup({ requested: "default" });
    expect(await enableReminders(t.deps)).toEqual({ kind: "dismissed" });
    expect(t.subscribe).not.toHaveBeenCalled();
  });

  it("skips the prompt when permission is already granted", async () => {
    const t = setup({ permission: "granted" });
    expect(await enableReminders(t.deps)).toMatchObject({ kind: "enabled" });
    expect(t.requestPermission).not.toHaveBeenCalled();
  });

  it("reports when push is not configured on the API", async () => {
    const t = setup({ vapid: { kind: "not-configured" } });
    expect(await enableReminders(t.deps)).toEqual({ kind: "not-configured" });
  });

  it("reports an API failure when saving fails", async () => {
    const t = setup({ save: { kind: "error" } });
    expect(await enableReminders(t.deps)).toEqual({ kind: "error" });
  });

  it("reports an error when the browser refuses to subscribe", async () => {
    const t = setup();
    t.subscribe.mockRejectedValueOnce(new Error("no"));
    expect(await enableReminders(t.deps)).toEqual({ kind: "error" });
  });
});

describe("syncOnLaunch", () => {
  it("never prompts and does nothing unless permission is already granted", async () => {
    for (const permission of ["default", "denied"] as const) {
      const t = setup({ permission });
      expect(await syncOnLaunch(t.deps)).toEqual({ kind: "skipped" });
      expect(t.requestPermission).not.toHaveBeenCalled();
      expect(t.saveSubscription).not.toHaveBeenCalled();
    }
  });

  it("saves the existing subscription again", async () => {
    const existing = fakeSub("https://push.example/old", [1, 2, 3]);
    const t = setup({ permission: "granted", existing });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/old" });
    expect(t.subscribe).not.toHaveBeenCalled();
    expect(t.saveSubscription).toHaveBeenCalledWith(existing.toJSON(), "TestAgent/1");
  });

  it("creates a subscription when the browser dropped it", async () => {
    const t = setup({ permission: "granted", existing: null });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/new" });
    expect(t.saveSubscription).toHaveBeenCalledOnce();
  });

  it("replaces a subscription made with a different key", async () => {
    const existing = fakeSub("https://push.example/old", [4, 5, 6]);
    const t = setup({ permission: "granted", existing, vapid: { kind: "ok", key: KEY } });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/new" });
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(t.subscribe).toHaveBeenCalledOnce();
  });

  it("keeps a subscription whose key matches", async () => {
    const existing = fakeSub("https://push.example/old", [4, 5, 6]);
    const t = setup({ permission: "granted", existing, vapid: { kind: "ok", key: OTHER_KEY } });
    await syncOnLaunch(t.deps);
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it("reports failure instead of throwing, so launch is never blocked", async () => {
    const t = setup({ permission: "granted", vapid: { kind: "error" } });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "error" });
    const broken = setup({ permission: "granted" });
    broken.deps.getRegistration = async () => {
      throw new Error("no service worker");
    };
    expect(await syncOnLaunch(broken.deps)).toEqual({ kind: "error" });
  });
});
