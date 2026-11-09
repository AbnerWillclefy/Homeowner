import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { voiceHandlers } from "../mocks/handlers/voice";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell, TABS } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers: the voice microphone in the top bar. It shows on all four tabs where the browser has speech
// recognition and not where it does not; a tap opens the panel already listening in the app language; the actions
// are reviewed, one is removed, and Confirm sends only the other, after which the Chores screen shows it; and the
// only request that carries speech is the JSON transcript to /home/voice/interpret.

const SPOKEN = "water the plants and sweep the porch";

/** A fake recognition that "hears" `window.__spoken` shortly after start(), and notes its language. */
async function fakeRecognition(page: Page, spoken = SPOKEN) {
  await page.addInitScript((words) => {
    const w = window as unknown as Record<string, unknown>;
    w["__voice"] = { starts: 0, aborts: 0, lang: "" };
    const Fake = class {
      lang = "";
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const state = w["__voice"] as { starts: number; lang: string };
        state.starts++;
        state.lang = this.lang;
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: words }]] });
          this.onend?.();
        }, 50);
      }
      abort() {
        (w["__voice"] as { aborts: number }).aborts++;
      }
    };
    // Chromium has both names; the app prefers the standard one, so both are replaced.
    w["SpeechRecognition"] = Fake;
    w["webkitSpeechRecognition"] = Fake;
  }, spoken);
}

const mic = (page: Page) => page.getByRole("button", { name: "Voice command" });

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  fakeApi.use(voiceHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

test("the mic shows in the top bar on all four tabs", async ({ page, baseURL }) => {
  await fakeRecognition(page);
  await launchApp(page, baseURL!);
  for (const name of TABS) {
    await shell.openTab(page, name);
    await shell.expectOnTab(page, name);
    await expect(shell.topBar(page).locator('[data-slot="voice"]').getByRole("button", { name: "Voice command" })).toBeVisible();
  }
});

test("the mic is absent where the browser has no speech recognition", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
  });
  await launchApp(page, baseURL!);
  await shell.expectOnToday(page);
  await expect(mic(page)).toHaveCount(0);
  await expect(shell.topBar(page).locator('[data-slot="voice"]')).toHaveCount(0);
});

test("tap, review, remove one, Confirm sends only the other and the Chores screen shows it", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page);
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Chores");
  await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();

  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  expect(await page.evaluate(() => (window as unknown as { __voice: { lang: string } }).__voice.lang)).toBe("en-US");
  await expect(dialog.getByText("New Chore: Water the plants, Weekly")).toBeVisible();
  await expect(dialog.getByText("New Chore: Sweep the porch, Weekly")).toBeVisible();
  // Nothing is changed until Confirm.
  expect(fakeApi.requests.filter((r) => r.method === "POST" && r.path === "/home/chores")).toHaveLength(0);

  await dialog.getByRole("button", { name: "Remove: New Chore: Water the plants, Weekly" }).click();
  await expect(dialog.getByText("Water the plants")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByText("Done", { exact: true })).toBeVisible();

  const created = fakeApi.requests.filter((r) => r.method === "POST" && r.path === "/home/chores");
  expect(created.map((r) => (r.body as { name: string }).name)).toEqual(["Sweep the porch"]);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(tabs.chores.chore(page, "Sweep the porch")).toBeVisible();
  await expect(tabs.chores.chore(page, "Water the plants")).toHaveCount(0);
});

test("the only request carrying speech is the JSON transcript to /home/voice/interpret", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page);
  const carrying: { url: string; type: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.method() !== "OPTIONS" && (request.postData() ?? "").includes("sweep the porch")) {
      carrying.push({ url: new URL(request.url()).pathname, type: request.headers()["content-type"] });
    }
  });
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Confirm" })).toBeVisible();
  expect(carrying).toHaveLength(1);
  expect(carrying[0]!.url).toBe("/home/voice/interpret");
  expect(carrying[0]!.type).toContain("application/json");
  expect(fakeApi.requests.find((r) => r.path === "/home/voice/interpret")?.body).toEqual({ transcript: SPOKEN, locale: "en-US" });
});

for (const [spoken, message] of [
  ["nothing", "I did not catch that. Say it again."],
  ["too many", "That is too much at once. Split it into smaller commands."],
] as const) {
  test(`"${spoken}" shows its message and changes nothing`, async ({ page, baseURL, fakeApi }) => {
    await fakeRecognition(page, spoken);
    await launchApp(page, baseURL!);
    await mic(page).click();
    await expect(page.getByRole("dialog").getByText(message)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Say it again" })).toBeVisible();
    expect(fakeApi.requests.filter((r) => r.method === "POST" && r.path === "/home/chores")).toHaveLength(0);
  });
}

test("closing while listening aborts the recognition and sends nothing", async ({ page, baseURL, fakeApi }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w["__aborts"] = 0;
    const Fake = class {
      start() {}
      abort() {
        (w["__aborts"] as number)++;
      }
    };
    w["SpeechRecognition"] = Fake;
    w["webkitSpeechRecognition"] = Fake;
  });
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByText("Listening. Say what you want done.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __aborts: number }).__aborts)).toBe(1);
  expect(fakeApi.requests.some((r) => r.path === "/home/voice/interpret")).toBe(false);
});

test.describe("pt-BR", () => {
  test.use({ locale: "pt-BR" });

  test("listens in Brazilian Portuguese and words the actions in it", async ({ page, baseURL }) => {
    await fakeRecognition(page);
    await launchApp(page, baseURL!);
    await page.getByRole("button", { name: "Comando de voz" }).click();
    const dialog = page.getByRole("dialog", { name: "Comando de voz" });
    await expect(dialog.getByText("Novo afazer: Water the plants, Semanal")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __voice: { lang: string } }).__voice.lang)).toBe("pt-BR");
  });
});
