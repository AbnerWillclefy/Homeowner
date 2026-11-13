import { afterEach, describe, expect, it, vi } from "vitest";
import type { PushWriteResult, SubscriptionJSON, VapidKeyResult } from "../api";
import { disableReminders, enableReminders, syncOnLaunch, type PushSubscriptionLike, type RemindersDeps } from "./reminders";

// "AQID" is bytes 1,2,3 and "BAUG" is bytes 4,5,6.
const KEY = "AQID";

function fakeSub(endpoint: string, keyBytes: number[] | null) {
  const json: SubscriptionJSON = { endpoint, keys: { p256dh: "pk", auth: "au" } };
  return { endpoint, options: { applicationServerKey: keyBytes ? new Uint8Array(keyBytes).buffer : null }, toJSON: () => json, unsubscribe: vi.fn(async () => true) } satisfies PushSubscriptionLike;
}

interface Setup {
  permission?: NotificationPermission;
  requested?: NotificationPermission;
  existing?: PushSubscriptionLike | null;
  vapid?: VapidKeyResult;
  save?: PushWriteResult;
  remove?: PushWriteResult;
}

function setup(o: Setup = {}) {
  const created = fakeSub("https://push.example/new", [1, 2, 3]);
  const calls: string[] = [];
  const subscribe = vi.fn(async (_opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }) => created);
  const requestPermission = vi.fn(async () => o.requested ?? "granted");
  const saveSubscription = vi.fn(async (_sub: SubscriptionJSON, _ua: string) => o.save ?? { kind: "ok" as const });
  const deleteSubscription = vi.fn(async (_endpoint: string) => {
    calls.push("delete");
    return o.remove ?? { kind: "ok" as const };
  });
  if (o.existing)
    vi.mocked(o.existing.unsubscribe).mockImplementation(async () => {
      calls.push("unsubscribe");
      return true;
    });
  const deps: RemindersDeps = {
    getPermission: () => o.permission ?? "default",
    requestPermission,
    getRegistration: async () => ({ pushManager: { getSubscription: async () => o.existing ?? null, subscribe } }),
    getVapidPublicKey: async () => o.vapid ?? { kind: "ok", key: KEY },
    saveSubscription,
    deleteSubscription,
    userAgent: "TestAgent/1",
  };
  return { deps, subscribe, requestPermission, saveSubscription, deleteSubscription, created, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("enableReminders", () => {
  it("asks permission, subscribes with the API's key and saves the subscription", async () => {
    const t = setup();
    expect(await enableReminders(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/new" });
    expect(t.requestPermission).toHaveBeenCalledOnce();
    expect(Array.from(t.subscribe.mock.calls[0]![0].applicationServerKey)).toEqual([1, 2, 3]);
    expect(t.saveSubscription).toHaveBeenCalledWith(t.created.toJSON(), "TestAgent/1");
  });

  it("skips the prompt when permission is already granted", async () => {
    const t = setup({ permission: "granted" });
    expect(await enableReminders(t.deps)).toMatchObject({ kind: "enabled" });
    expect(t.requestPermission).not.toHaveBeenCalled();
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

  it("reports 503 as not configured, a failed key as error, and a refused save as error or not signed in", async () => {
    expect(await enableReminders(setup({ vapid: { kind: "not-configured" } }).deps)).toEqual({ kind: "not-configured" });
    const noKey = setup({ vapid: { kind: "error" } });
    expect(await enableReminders(noKey.deps)).toEqual({ kind: "error" });
    expect(noKey.saveSubscription).not.toHaveBeenCalled();
    expect(await enableReminders(setup({ save: { kind: "error" } }).deps)).toEqual({ kind: "error" });
    expect(await enableReminders(setup({ save: { kind: "not-signed-in" } }).deps)).toEqual({ kind: "not-signed-in" });
  });

  it("names the browser error when subscribing fails, never its message, and does not call the API", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup();
    t.subscribe.mockRejectedValueOnce(new DOMException("secret internal detail", "AbortError"));
    const result = await enableReminders(t.deps);
    expect(result).toEqual({ kind: "browser-error", name: "AbortError" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(t.saveSubscription).not.toHaveBeenCalled();
  });

  it("maps a thrown non-Error to the name unknown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup();
    t.subscribe.mockRejectedValueOnce("boom");
    expect(await enableReminders(t.deps)).toEqual({ kind: "browser-error", name: "unknown" });
  });

  it("replaces a subscription made with a different key", async () => {
    const existing = fakeSub("https://push.example/old", [4, 5, 6]);
    const t = setup({ permission: "granted", existing });
    expect(await enableReminders(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/new" });
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("syncOnLaunch", () => {
  it("never prompts and skips unless permission is already granted", async () => {
    for (const permission of ["default", "denied"] as const) {
      const t = setup({ permission });
      expect(await syncOnLaunch(t.deps)).toEqual({ kind: "skipped" });
      expect(t.requestPermission).not.toHaveBeenCalled();
      expect(t.saveSubscription).not.toHaveBeenCalled();
    }
  });

  it("does not subscribe a device that turned notifications off (granted, no subscription)", async () => {
    const t = setup({ permission: "granted", existing: null });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "skipped" });
    expect(t.subscribe).not.toHaveBeenCalled();
    expect(t.saveSubscription).not.toHaveBeenCalled();
  });

  it("saves the existing subscription again", async () => {
    const existing = fakeSub("https://push.example/old", [1, 2, 3]);
    const t = setup({ permission: "granted", existing });
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "enabled", endpoint: "https://push.example/old" });
    expect(t.subscribe).not.toHaveBeenCalled();
    expect(t.saveSubscription).toHaveBeenCalledWith(existing.toJSON(), "TestAgent/1");
  });

  it("returns a browser error instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup({ permission: "granted" });
    t.deps.getRegistration = async () => {
      throw new DOMException("no worker", "AbortError");
    };
    expect(await syncOnLaunch(t.deps)).toEqual({ kind: "skipped" });
  });
});

describe("disableReminders", () => {
  it("unsubscribes in the browser, then deletes the registration by endpoint", async () => {
    const t = setup({ permission: "granted", existing: fakeSub("https://push.example/old", [1, 2, 3]) });
    expect(await disableReminders(t.deps)).toEqual({ kind: "disabled" });
    expect(t.calls).toEqual(["unsubscribe", "delete"]);
    expect(t.deleteSubscription).toHaveBeenCalledWith("https://push.example/old");
  });

  it("has nothing to do when the device is not subscribed", async () => {
    const t = setup({ permission: "granted" });
    expect(await disableReminders(t.deps)).toEqual({ kind: "disabled" });
    expect(t.deleteSubscription).not.toHaveBeenCalled();
  });

  it("reports a failed DELETE and a failed unsubscribe", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = setup({ existing: fakeSub("https://push.example/old", null), remove: { kind: "error" } });
    expect(await disableReminders(failed.deps)).toEqual({ kind: "error" });
    const stuck = fakeSub("https://push.example/old", null);
    stuck.unsubscribe.mockRejectedValueOnce(new DOMException("x", "InvalidStateError"));
    const t = setup({ existing: stuck });
    expect(await disableReminders(t.deps)).toEqual({ kind: "browser-error", name: "InvalidStateError" });
    expect(t.deleteSubscription).not.toHaveBeenCalled();
  });
});
