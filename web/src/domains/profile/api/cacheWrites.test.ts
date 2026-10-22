import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../shared/query/testing";
import { meKey } from "../../auth/api/queries";
import type { Me } from "../../auth/api/meApi";
import { residentKey, residentsKey } from "../../residents/api/queries";
import { saveMe, savePhoto } from "./cacheWrites";

const OLD: Me = { id: "u1", email: "a@b.c", displayName: null, name: "Old", photoUrl: null, initials: "O", avatarTone: "kitchen" };
const NEW: Me = { ...OLD, displayName: "New", name: "New", initials: "N" };

function seeded() {
  const client = createTestQueryClient();
  client.setQueryData(meKey, OLD);
  client.setQueryData(residentsKey, []);
  client.setQueryData(residentKey("r2"), { id: "r2" });
  return client;
}

describe("saveMe (a saved name)", () => {
  it("puts the answer in me and marks the residents list and every resident page stale", async () => {
    const client = seeded();
    await saveMe(client, NEW);
    expect(client.getQueryData(meKey)).toEqual(NEW);
    expect(client.getQueryState(residentsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(residentKey("r2"))?.isInvalidated).toBe(true);
  });

  it("keeps the saved User when a read that started earlier answers afterwards", async () => {
    const client = seeded();
    let answerOld!: (me: Me) => void;
    const read = client
      .fetchQuery({ queryKey: meKey, queryFn: () => new Promise<Me>((r) => (answerOld = r)), staleTime: 0 })
      .catch(() => undefined);
    await saveMe(client, NEW);
    answerOld(OLD);
    await read;
    expect(client.getQueryData(meKey)).toEqual(NEW);
  });
});

describe("savePhoto", () => {
  it("changes only the photo of the newest User and invalidates the residents", async () => {
    const client = seeded();
    await saveMe(client, NEW);
    await savePhoto(client, "https://x/p.jpg");
    expect(client.getQueryData(meKey)).toEqual({ ...NEW, photoUrl: "https://x/p.jpg" });
    await savePhoto(client, null);
    expect((client.getQueryData(meKey) as Me).photoUrl).toBeNull();
    expect(client.getQueryState(residentsKey)?.isInvalidated).toBe(true);
  });
});
