import { test, expect } from "../fixtures";

// What this covers: the built index.html's head. The service worker registration script is deferred and keeps its
// name, every latin Nunito woff2 has a preload that the server answers, the API origin has a preconnect with
// crossorigin, and the charset meta stays within the first 1024 bytes. The document is fetched directly, so no app
// or API mock is involved. The worker itself is blocked in these tests, so offline start is checked by hand.

let html: string;

test.beforeAll(async ({ playwright }, testInfo) => {
  const context = await playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
  });
  html = await (await context.get("/")).text();
  await context.dispose();
});

const tags = (pattern: RegExp) => html.match(pattern) ?? [];

test("registers the service worker with a deferred script of the same name", () => {
  const scripts = tags(/<script\b[^>]*id="vite-plugin-pwa:register-sw"[^>]*>/g);
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toMatch(/\bsrc="\/registerSW\.js"/);
  expect(scripts[0]).toMatch(/\bdefer\b/);
});

test("preloads every Nunito file by its hashed name, and the server answers for it", async ({ request }) => {
  const preloads = tags(/<link\b[^>]*rel="preload"[^>]*>/g).filter((tag) => /nunito-latin-\d+-normal-/.test(tag));
  expect(preloads.length).toBeGreaterThan(0);
  for (const tag of preloads) {
    expect(tag).toMatch(/\bas="font"/);
    expect(tag).toMatch(/\btype="font\/woff2"/);
    expect(tag).toMatch(/\bcrossorigin\b/);
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
    expect(href).toBeTruthy();
    expect((await request.get(href!)).status()).toBe(200);
  }
});

test("preconnects to the API origin with crossorigin", () => {
  const preconnects = tags(/<link\b[^>]*rel="preconnect"[^>]*>/g);
  expect(preconnects).toHaveLength(1);
  expect(preconnects[0]).toMatch(/\bhref="https:\/\/api\.e2e\.test"/);
  expect(preconnects[0]).toMatch(/\bcrossorigin\b/);
});

test("keeps the charset meta within the first 1024 bytes", () => {
  const at = html.indexOf("charset");
  expect(at).toBeGreaterThan(-1);
  expect(Buffer.byteLength(html.slice(0, at))).toBeLessThan(1024);
});
