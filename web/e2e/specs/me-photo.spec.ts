import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json, type FakeState, type RecordedRequest } from "../mocks/api";
import { NEW_PHOTO_URL } from "../mocks/handlers/photos";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { createFakeStorage, type FakeStorage } from "../mocks/photoStorage";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers, in both locales: choosing a photo shows a square preview at the Me and list sizes and sends
// nothing; Choose another replaces it; Save runs ask, put, confirm and the Me header changes and the Residents list reloads with no page reload; a refused
// put shows a retry that asks again; a 503 says photos are off; Remove returns to initials; an EXIF-rotated photo
// previews upright; a file that is not an image keeps the current photo.

const FIXTURES = path.join(process.cwd(), "e2e", "fixtures");
const LANDSCAPE = path.join(FIXTURES, "landscape.jpg");
const PORTRAIT_EXIF6 = path.join(FIXTURES, "portrait-exif6.jpg");
const NOT_AN_IMAGE = path.join(FIXTURES, "not-an-image.jpg");

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    edit: "Editar nome e foto",
    choose: "Escolher foto",
    another: "Escolher outra",
    save: "Salvar foto",
    retry: "Tentar de novo",
    remove: "Remover foto",
    caption: "Assim ela vai ficar",
    unreadable: "Não foi possível ler este arquivo. Escolha uma foto JPEG, PNG ou WebP.",
    saveFailed: "A foto não foi salva e a atual continua a mesma. Tente de novo.",
    off: "Fotos indisponíveis no momento. Tente mais tarde.",
  },
  {
    locale: "en-US",
    me: "Me",
    edit: "Edit name and photo",
    choose: "Choose photo",
    another: "Choose another",
    save: "Save photo",
    retry: "Try again",
    remove: "Remove photo",
    caption: "This is how it will look",
    unreadable: "We could not read this file. Choose a photo in JPEG, PNG or WebP.",
    saveFailed: "The photo was not saved and your current photo is unchanged. Try again.",
    off: "Photos are not available right now. Try again later.",
  },
] as const;

/** A Resident named Abner Lima with a Home, with or without a photo. */
function resident(withPhoto: boolean): FakeState {
  const state = signedInResident();
  state.user.displayName = "Abner Lima";
  state.residents![0]!.name = "Abner Lima";
  if (withPhoto) {
    state.user.photoUrl = NEW_PHOTO_URL;
    state.residents![0]!.photoUrl = NEW_PHOTO_URL;
  }
  return state;
}

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
const fileInput = (page: Page) => page.locator('input[type="file"]');
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const photoRequests = (requests: RecordedRequest[]) => requests.filter((r) => r.path.startsWith("/me/photo"));
/** The photos the new photo has reached: any image showing the fake's photo URL. */
const newPhotos = (page: Page) => page.locator(`img[src^="data:image/svg+xml"]`);

/** The colour of one pixel of an image, as a fraction of its width and height, read at its natural size. */
function pixelAt(image: Locator, fx: number, fy: number): Promise<[number, number, number]> {
  return image.evaluate(
    (element, [x, y]) => {
      const img = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(img, 0, 0);
      const [r, g, b] = context.getImageData(Math.floor(x! * img.naturalWidth), Math.floor(y! * img.naturalHeight), 1, 1).data;
      return [r!, g!, b!] as [number, number, number];
    },
    [fx, fy],
  );
}

const isRed = ([r, , b]: number[]) => r! > 200 && b! < 70;
const isBlue = ([r, , b]: number[]) => b! > 200 && r! < 70;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    let storage: FakeStorage;

    test.beforeEach(async ({ page, fakeApi, router }) => {
      storage = createFakeStorage();
      router.add(storage);
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    async function openEdit(page: Page, baseURL: string | undefined) {
      await launchApp(page, baseURL!);
      await nav(page, l.me).click();
      await page.getByRole("link", { name: l.edit }).click();
      await expect(page).toHaveURL(/\/me\/edit$/);
    }

    /** The two preview images: the large one first, then the list-sized one. */
    const previews = (page: Page) => page.getByRole("figure").locator("img");

    test.describe("without a photo", () => {
      test.use({ fakeState: resident(false) });

      test("picking shows a square preview at both sizes and sends nothing", async ({ page, baseURL, fakeApi }) => {
        await openEdit(page, baseURL);
        await expect(page.getByRole("button", { name: l.remove })).toHaveCount(0);
        const before = fakeApi.requests.length;

        await fileInput(page).setInputFiles(LANDSCAPE);
        await expect(page.getByText(l.caption)).toBeVisible();
        await expect(previews(page)).toHaveCount(2);
        const large = previews(page).first();
        const small = previews(page).last();
        expect(await large.evaluate((el) => [(el as HTMLImageElement).naturalWidth, (el as HTMLImageElement).naturalHeight])).toEqual([512, 512]);
        const largeBox = (await large.boundingBox())!;
        const smallBox = (await small.boundingBox())!;
        expect(largeBox.width).toBeCloseTo(largeBox.height, 0);
        expect(smallBox.width).toBeCloseTo(smallBox.height, 0);
        expect(largeBox.width).toBeGreaterThan(smallBox.width);

        await expect(page.getByText(l.another, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: l.save, exact: true })).toBeEnabled();
        expect(fakeApi.requests.length).toBe(before);
        expect(storage.puts).toHaveLength(0);
        expect(await noOverflow(page)).toBe(true);
      });

      test("Choose another replaces the preview", async ({ page, baseURL }) => {
        await openEdit(page, baseURL);
        await fileInput(page).setInputFiles(LANDSCAPE);
        await expect(previews(page)).toHaveCount(2);
        const first = await previews(page).first().getAttribute("src");

        await fileInput(page).setInputFiles(PORTRAIT_EXIF6);
        await expect(async () => {
          expect(await previews(page).first().getAttribute("src")).not.toBe(first);
        }).toPass();
        await expect(previews(page)).toHaveCount(2);
      });

      test("a landscape photo is centre-cropped and a photo with EXIF orientation 6 previews upright", async ({ page, baseURL }) => {
        await openEdit(page, baseURL);
        // Landscape: red on the left, blue on the right.
        await fileInput(page).setInputFiles(LANDSCAPE);
        const large = previews(page).first();
        await expect(large).toBeVisible();
        expect(isRed(await pixelAt(large, 0.1, 0.5))).toBe(true);
        expect(isBlue(await pixelAt(large, 0.9, 0.5))).toBe(true);

        // Stored on its side with orientation 6: shown upright it is red on top and blue below.
        await fileInput(page).setInputFiles(PORTRAIT_EXIF6);
        await expect(async () => {
          expect(isRed(await pixelAt(previews(page).first(), 0.5, 0.1))).toBe(true);
        }).toPass();
        expect(isBlue(await pixelAt(previews(page).first(), 0.5, 0.9))).toBe(true);
      });

      test("Save asks, puts and confirms in order, without the token going to storage, and the photo shows everywhere without a reload", async ({
        page,
        baseURL,
        fakeApi,
      }) => {
        let putsWhenConfirmed = -1;
        fakeApi.override("PUT /me/photo", (request, state) => {
          putsWhenConfirmed = storage.puts.length;
          const key = (request.body as { key: string }).key;
          expect(key).toMatch(/^pending\/user-1\//);
          state.user.photoUrl = NEW_PHOTO_URL;
          state.residents![0]!.photoUrl = NEW_PHOTO_URL;
          return json(200, { photoUrl: NEW_PHOTO_URL });
        });
        await openEdit(page, baseURL);
        await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
        const residentsBefore = fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/residents").length;
        await fileInput(page).setInputFiles(LANDSCAPE);
        await expect(previews(page)).toHaveCount(2);
        await page.getByRole("button", { name: l.save, exact: true }).click();

        // The new photo replaces the preview on the edit screen, with a Remove button now offered.
        await expect(page.getByRole("button", { name: l.remove })).toBeVisible();
        await expect(page.getByText(l.caption)).toHaveCount(0);
        await expect(newPhotos(page).first()).toBeVisible();

        const calls = photoRequests(fakeApi.requests).map((r) => `${r.method} ${r.path}`);
        expect(calls).toEqual(["POST /me/photo/uploads", "PUT /me/photo"]);
        const asked = photoRequests(fakeApi.requests)[0]!.body as { contentType: string; size: number };
        expect(asked.contentType).toBe("image/webp");
        expect(asked.size).toBeGreaterThan(0);
        expect(asked.size).toBeLessThanOrEqual(524288);
        expect(putsWhenConfirmed).toBe(1);

        expect(storage.puts).toHaveLength(1);
        const put = storage.puts[0]!;
        expect(put.method).toBe("PUT");
        expect(put.url).toMatch(/^https:\/\/photos\.test\/pending\/user-1\//);
        expect(put.contentType).toBe("image/webp");
        expect(put.authorization).toBeNull();
        expect(put.headers).not.toHaveProperty("authorization");

        await page.getByRole("link", { name: /^(Back|Voltar)$/ }).click();
        await expect(newPhotos(page).first()).toBeVisible();
        // The Residents list behind Today and the Home screen was asked for again, so it holds the new photo.
        expect(fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/residents").length).toBeGreaterThan(residentsBefore);
        expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
      });

      test("a refused put shows a retry message, keeps the old avatar, and Retry asks again and succeeds", async ({ page, baseURL, fakeApi }) => {
        storage.failNext(403);
        await openEdit(page, baseURL);
        await fileInput(page).setInputFiles(LANDSCAPE);
        await page.getByRole("button", { name: l.save, exact: true }).click();

        await expect(page.getByRole("alert").filter({ hasText: l.saveFailed })).toBeVisible();
        // The screen is not half-saved: still previewing, nothing confirmed, the current photo unchanged.
        expect(photoRequests(fakeApi.requests).map((r) => r.method)).toEqual(["POST"]);
        expect(fakeApi.state.user.photoUrl).toBeUndefined();
        await expect(page.getByRole("button", { name: l.remove })).toHaveCount(0);
        await expect(page.getByText(l.caption)).toBeVisible();

        await page.getByRole("button", { name: l.retry, exact: true }).click();
        await expect(page.getByRole("button", { name: l.remove })).toBeVisible();
        await expect(page.getByRole("alert").filter({ hasText: l.saveFailed })).toHaveCount(0);
        // Retry started again from ask: a second upload was requested, never the old one reused.
        expect(photoRequests(fakeApi.requests).map((r) => `${r.method} ${r.path}`)).toEqual([
          "POST /me/photo/uploads",
          "POST /me/photo/uploads",
          "PUT /me/photo",
        ]);
        expect(storage.puts).toHaveLength(2);
      });

      test("a 503 on ask says photos are not available and nothing is put", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("POST /me/photo/uploads", json(503, { error: "photos not configured" }));
        await openEdit(page, baseURL);
        await fileInput(page).setInputFiles(LANDSCAPE);
        await page.getByRole("button", { name: l.save, exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: l.off })).toBeVisible();
        expect(storage.puts).toHaveLength(0);
        await expect(page.getByRole("button", { name: l.retry, exact: true })).toBeEnabled();
      });

      test("a failed confirm leaves the photo unchanged and can be retried", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("PUT /me/photo", json(500, { error: "internal error" }), { once: true });
        await openEdit(page, baseURL);
        await fileInput(page).setInputFiles(LANDSCAPE);
        await page.getByRole("button", { name: l.save, exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: l.saveFailed })).toBeVisible();
        expect(fakeApi.state.user.photoUrl).toBeUndefined();
        await page.getByRole("button", { name: l.retry, exact: true }).click();
        await expect(page.getByRole("button", { name: l.remove })).toBeVisible();
      });

      test("a file that is not an image shows a message and sends nothing", async ({ page, baseURL, fakeApi }) => {
        await openEdit(page, baseURL);
        const before = fakeApi.requests.length;
        await fileInput(page).setInputFiles(NOT_AN_IMAGE);
        await expect(page.getByRole("alert").filter({ hasText: l.unreadable })).toBeVisible();
        await expect(page.getByText(l.caption)).toHaveCount(0);
        await expect(page.getByText(l.choose, { exact: true })).toBeVisible();
        expect(fakeApi.requests.length).toBe(before);
        expect(storage.puts).toHaveLength(0);
      });
    });

    test.describe("with a photo", () => {
      test.use({ fakeState: resident(true) });

      test("a file that is not an image keeps the current photo", async ({ page, baseURL }) => {
        await openEdit(page, baseURL);
        await fileInput(page).setInputFiles(NOT_AN_IMAGE);
        await expect(page.getByRole("alert").filter({ hasText: l.unreadable })).toBeVisible();
        await expect(newPhotos(page).first()).toBeVisible();
        await expect(page.getByRole("button", { name: l.remove })).toBeVisible();
      });

      test("Remove needs no confirmation and returns the avatar to initials", async ({ page, baseURL, fakeApi }) => {
        await openEdit(page, baseURL);
        await expect(newPhotos(page).first()).toBeVisible();
        const button = page.getByRole("button", { name: l.remove });
        expect(((await button.boundingBox())!).height).toBeGreaterThanOrEqual(44);
        await button.click();

        await expect(page.getByText("AL", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: l.remove })).toHaveCount(0);
        await expect(newPhotos(page)).toHaveCount(0);
        expect(photoRequests(fakeApi.requests).map((r) => `${r.method} ${r.path}`)).toEqual(["DELETE /me/photo"]);
        // Replacing is offered again as a first choice.
        await expect(page.getByText(l.choose, { exact: true })).toBeVisible();
      });

      test("the choose control is a large, keyboard-reachable target", async ({ page, baseURL }) => {
        await openEdit(page, baseURL);
        const label = page.locator("label").filter({ has: fileInput(page) });
        const box = (await label.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        await fileInput(page).focus();
        await expect(fileInput(page)).toBeFocused();
        expect(await noOverflow(page)).toBe(true);
      });
    });
  });
}
