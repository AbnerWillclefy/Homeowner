import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
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

const UNAVAILABLE = "Voice is not available right now.";

/** A fake recognition that fails to start with the browser's error `code`. */
async function failingRecognition(page: Page, code: string) {
  await page.addInitScript((error) => {
    const Fake = class {
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => this.onerror?.({ error }), 50);
      }
      abort() {}
    };
    const w = window as unknown as Record<string, unknown>;
    w["SpeechRecognition"] = Fake;
    w["webkitSpeechRecognition"] = Fake;
  }, code);
}

test("microphone permission refused explains how to allow it, with no request", async ({ page, baseURL, fakeApi }) => {
  await failingRecognition(page, "not-allowed");
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByText(/Allow the microphone for this app/)).toBeVisible();
  expect(fakeApi.requests.some((r) => r.path === "/home/voice/interpret")).toBe(false);
});

test("Safari with Siri off says voice is unavailable and the mic is gone once the panel closes", async ({ page, baseURL }) => {
  await failingRecognition(page, "service-not-allowed");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Voice is not available on this device.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Say it again" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(mic(page)).toHaveCount(0);
});

test("the Resident is asked which Task, and Confirm stays off until one is picked", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page, "complete the laundry");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  const confirm = dialog.getByRole("button", { name: "Confirm" });
  await expect(dialog.getByText("Accept Laundry")).toBeVisible();
  await expect(dialog.getByText("Take Laundry")).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByText("Pick one option to confirm.")).toBeVisible();
  await dialog.getByText("Take Laundry").click();
  await expect(confirm).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Remove: Take Laundry" })).toBeVisible();
  expect(fakeApi.requests.some((r) => r.path.startsWith("/home/tasks/"))).toBe(false);
});

test("removing the ambiguous action unblocks Confirm for the others", async ({ page, baseURL }) => {
  await fakeRecognition(page, "complete the laundry");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  await dialog.getByRole("button", { name: /^Remove/ }).click();
  await expect(dialog.getByText("Nothing left to apply.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm" })).toBeDisabled();
});

test("one failed action does not stop the others and its reason is shown", async ({ page, baseURL, fakeApi }) => {
  fakeApi.override("POST /home/tasks/{id}/complete", (request, state) =>
    request.params.id === "task-b" ? json(409, { error: "already_done" }) : json(200, state.dayPlan),
  );
  await fakeRecognition(page, "three tasks");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByText("Did not work")).toHaveCount(1);
  await expect(dialog.getByText("Done", { exact: true })).toHaveCount(2);
  await expect(dialog.getByText(/Complete Dishes/)).toContainText("Did not work");
  expect(fakeApi.requests.filter((r) => r.path.endsWith("/complete")).map((r) => r.path)).toEqual([
    "/home/tasks/task-a/complete",
    "/home/tasks/task-b/complete",
    "/home/tasks/task-c/complete",
  ]);
});

test("after the last command of the day the next tap says so and sends nothing", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page, "the last one");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  await expect(dialog.getByText("Voice commands left today: 0")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await mic(page).click();
  await expect(dialog.getByText("You have used today's voice commands. They reset tomorrow.")).toBeVisible();
  expect(fakeApi.requests.filter((r) => r.path === "/home/voice/interpret")).toHaveLength(1);
});

test("the limit gate lifts on the next local day and the tap reaches the server", async ({ page, baseURL, fakeApi }) => {
  await page.clock.setFixedTime(new Date("2030-01-15T22:00:00-03:00"));
  await fakeRecognition(page, "the last one");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog", { name: "Voice command" });
  await expect(dialog.getByText("Voice commands left today: 0")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.clock.setFixedTime(new Date("2030-01-16T08:00:00-03:00"));
  await mic(page).click();
  await expect.poll(() => fakeApi.requests.filter((r) => r.path === "/home/voice/interpret").length).toBe(2);
});

test("a 429 shows the limit message", async ({ page, baseURL }) => {
  await fakeRecognition(page, "limit");
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByText("You have used today's voice commands. They reset tomorrow.")).toBeVisible();
});

test("a 504 offers Try again, which sends the same words and changes nothing", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page, "slow");
  await launchApp(page, baseURL!);
  await mic(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Could not understand right now. Nothing was changed.")).toBeVisible();
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => fakeApi.requests.filter((r) => r.path === "/home/voice/interpret").length).toBe(2);
  const bodies = fakeApi.requests.filter((r) => r.path === "/home/voice/interpret").map((r) => r.body);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(fakeApi.requests.filter((r) => r.method !== "GET" && r.path !== "/home/voice/interpret")).toHaveLength(0);
});

test("a transcript over 500 characters is never sent", async ({ page, baseURL, fakeApi }) => {
  await fakeRecognition(page, "a".repeat(501));
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByText("I did not catch that. Say it again.")).toBeVisible();
  expect(fakeApi.requests.some((r) => r.path === "/home/voice/interpret")).toBe(false);
});

test("a 503 from interpret says voice is unavailable", async ({ page, baseURL }) => {
  await fakeRecognition(page, "unavailable");
  await launchApp(page, baseURL!);
  await mic(page).click();
  await expect(page.getByRole("dialog").getByText(UNAVAILABLE)).toBeVisible();
});

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
