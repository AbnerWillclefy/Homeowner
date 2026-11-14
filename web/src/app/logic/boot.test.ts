import { describe, expect, it } from "vitest";
import { BOOT_WINDOW_MS, createBoot, type BootSections } from "./boot";

const SECTIONS: BootSections = {
  "/home": { status: 200, body: { id: "h1" } },
  "/me/finance/bills?month=2030-01": { status: 200, body: [] },
  "/home/streak": { status: 503, body: { error: "down" } },
  "/demands": { status: 404, body: { error: "no home" } },
};

function setup(sections: BootSections | null = SECTIONS) {
  let now = 1_000;
  const boot = createBoot(() => now);
  const started = boot.start(async () => sections);
  return { boot, started, later: (ms: number) => (now += ms) };
}

describe("boot.take", () => {
  it("serves a matching GET once, as the response the endpoint would have given", async () => {
    const { boot } = setup();
    const response = await boot.take({ url: "/home" });
    expect(response).toMatchObject({ status: 200, data: { id: "h1" }, headers: {} });
    expect(await boot.take({ url: "/home", method: "GET" })).toBeNull();
  });

  it("serves a 4xx section, which the domain's own parser maps", async () => {
    const { boot } = setup();
    expect(await boot.take({ url: "/demands" })).toMatchObject({ status: 404, data: { error: "no home" } });
  });

  it("waits for a boot still in flight", async () => {
    let answer!: (s: BootSections) => void;
    const boot = createBoot(() => 0);
    void boot.start(() => new Promise((resolve) => (answer = resolve)));
    const taken = boot.take({ url: "/home" });
    answer(SECTIONS);
    expect(await taken).toMatchObject({ status: 200 });
  });

  it("matches the params with the key, whatever their order", async () => {
    const { boot } = setup({ "/x?a=1&b=2": { status: 200, body: 1 } });
    expect(await boot.take({ url: "/x", params: { b: "2", a: "1" } })).toMatchObject({ data: 1 });
  });

  it("serves the section a request with params names", async () => {
    const { boot } = setup();
    expect(await boot.take({ url: "/me/finance/bills", params: { month: "2030-01" } })).toMatchObject({ status: 200 });
    expect(await boot.take({ url: "/me/finance/bills", params: { month: "2030-02" } })).toBeNull();
  });

  it("falls through for a 5xx section and a section that is absent", async () => {
    const { boot } = setup();
    expect(await boot.take({ url: "/home/streak" })).toBeNull();
    expect(await boot.take({ url: "/home/residents" })).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("never serves a %s", async (method) => {
    const { boot } = setup();
    expect(await boot.take({ url: "/home", method })).toBeNull();
  });

  it("falls through when the boot failed", async () => {
    const { boot } = setup(null);
    expect(await boot.take({ url: "/home" })).toBeNull();
  });

  it("falls through when the boot request throws", async () => {
    const boot = createBoot(() => 0);
    await boot.start(() => Promise.reject(new Error("offline")));
    expect(await boot.take({ url: "/home" })).toBeNull();
  });

  it("serves nothing once the window has passed", async () => {
    const { boot, started, later } = setup();
    await started;
    later(BOOT_WINDOW_MS + 1);
    expect(await boot.take({ url: "/home" })).toBeNull();
  });

  it("serves nothing after clear, even from a boot still in flight", async () => {
    let answer!: (s: BootSections) => void;
    const boot = createBoot(() => 0);
    void boot.start(() => new Promise((resolve) => (answer = resolve)));
    boot.clear();
    answer(SECTIONS);
    expect(await boot.take({ url: "/home" })).toBeNull();
  });

  it("start resolves to the sections that can be served, or null", async () => {
    const { started } = setup();
    expect(Object.keys((await started)!).sort()).toEqual(["/demands", "/home", "/me/finance/bills?month=2030-01"]);
    expect(await setup(null).started).toBeNull();
  });
});
