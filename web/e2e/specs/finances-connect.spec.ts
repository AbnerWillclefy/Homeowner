import { createHash } from "node:crypto";
import { test, expect } from "../fixtures";
import { pluggyConnectSri } from "../env";
import { PLUGGY_STUB } from "../mocks/pluggyCdn";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: the Finances tab walks a User through Pluggy (why each step matters), saves the
// Client ID and Secret without ever showing them again, loads the Pluggy Connect script only on the tap, registers the
// item the widget returns, lists the Sources while the import runs, and deletes on request. The widget and the CDN are
// stubs (e2e/mocks/pluggyCdn.ts); the e2e build keeps `integrity` on, with the stub's own hash.

const CLIENT_ID = "client-id-visible-123";
const SECRET = "client-secret-hidden-456";

const LOCALES = [
  {
    locale: "pt-BR",
    steps: "Três passos para conectar seus bancos",
    link: "Abrir meu.pluggy.ai (nova aba)",
    id: "Client ID",
    secret: "Client Secret",
    save: "Salvar credenciais",
    saved: "Credenciais salvas",
    replace: "Substituir",
    remove: "Remover",
    removeConfirm: "Remover credenciais",
    cancel: "Cancelar",
    connect: "Conectar bancos",
    closed: "Nada foi conectado. Você pode tentar de novo quando quiser.",
    importing: "Importando seus lançamentos…",
    lastSync: /Última atualização: .*2026/,
    checking: "Conta corrente",
    card: "Cartão de crédito",
    rejected: "Não conseguimos entrar no Pluggy com essas credenciais.",
    del: "Apagar meus dados financeiros",
    delTitle: "Apagar seus dados financeiros?",
    stays: /continuam conectados no MeuPluggy/,
    settings: "Ajustes",
  },
  {
    locale: "en-US",
    steps: "Three steps to connect your banks",
    link: "Open meu.pluggy.ai (new tab)",
    id: "Client ID",
    secret: "Client Secret",
    save: "Save credentials",
    saved: "Credentials saved",
    replace: "Replace",
    remove: "Remove",
    removeConfirm: "Remove credentials",
    cancel: "Cancel",
    connect: "Connect banks",
    closed: "Nothing was connected. You can try again whenever you like.",
    importing: "Importing your transactions…",
    lastSync: /Last synced .*2026/,
    checking: "Checking account",
    card: "Credit card",
    rejected: "We could not sign in to Pluggy with these credentials.",
    del: "Delete my finance data",
    delTitle: "Delete your finance data?",
    stays: /stay connected in MeuPluggy/,
    settings: "Settings",
  },
] as const;

const resident = () => {
  const s = signedInResident();
  s.user.finance = true;
  return s;
};

const configured = () => {
  const s = resident();
  s.finance = {
    configured: true,
    sources: [
      { id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" },
      { id: "source-2", name: "Pluggy Bank", kind: "credit_card", currency: "BRL" },
    ],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
  };
  return s;
};

test("the e2e build's script hash is the stub's own hash", () => {
  expect(pluggyConnectSri).toBe(`sha384-${createHash("sha384").update(PLUGGY_STUB).digest("base64")}`);
});

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    test.describe("without credentials", () => {
      test.use({ fakeState: resident() });

      test("explains the steps, links to MeuPluggy, and masks the Secret", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByRole("heading", { name: l.steps })).toBeVisible();
        const link = page.getByRole("link", { name: l.link });
        await expect(link).toHaveAttribute("href", "https://meu.pluggy.ai");
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
        await expect(page.getByLabel(l.secret)).toHaveAttribute("type", "password");
        await expect(page.getByLabel(l.id)).toHaveAttribute("autocomplete", "off");
        await expect(page.getByLabel(l.secret)).toHaveAttribute("autocomplete", "off");
      });

      test("at 320px and the largest text the steps and the form do not overflow sideways", async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByRole("heading", { name: l.steps })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });

      test("saves the credentials and the page holds neither value afterwards", async ({ page, baseURL, fakeApi }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByLabel(l.id).fill(CLIENT_ID);
        await page.getByLabel(l.secret).fill(SECRET);
        await page.getByRole("button", { name: l.save }).click();

        await expect(page.getByText(l.saved, { exact: true })).toBeVisible();
        const put = fakeApi.requests.find((r) => r.method === "PUT" && r.path === "/me/finance/credentials");
        expect(put?.body).toEqual({ clientId: CLIENT_ID, clientSecret: SECRET });

        const html = await page.content();
        expect(html).not.toContain(CLIENT_ID);
        expect(html).not.toContain(SECRET);
        const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
        expect(stored).not.toContain(CLIENT_ID);
        expect(stored).not.toContain(SECRET);
        expect(page.url()).not.toContain(SECRET);
        // Replace shows the form again, empty.
        await page.getByRole("button", { name: l.replace }).click();
        await expect(page.getByLabel(l.id)).toHaveValue("");
        await expect(page.getByLabel(l.secret)).toHaveValue("");
      });
    });

    test.describe("with credentials", () => {
      test.use({ fakeState: configured() });

      test("lists the Sources and the last sync, and asks nothing of the CDN before the tap", async ({ page, baseURL, pluggyCdn }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await expect(page.getByText(l.saved, { exact: true })).toBeVisible();
        await expect(page.getByText(l.checking, { exact: true })).toBeVisible();
        await expect(page.getByText(l.card, { exact: true })).toBeVisible();
        await expect(page.getByText(l.lastSync)).toBeVisible();
        await expect(page.getByText(l.importing)).toHaveCount(0);
        expect(pluggyCdn.requests).toEqual([]);
        await expect(page.locator("script[src*='pluggy']")).toHaveCount(0);
      });

      test("connects: token, widget, then the item is registered and the import shows", async ({ page, baseURL, fakeApi, pluggyCdn }) => {
        await page.addInitScript(() => {
          Object.assign(window, { __pluggyMode: "success", __pluggyItemId: "item-abc" });
        });
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await page.getByRole("button", { name: l.connect }).click();

        await expect(page.getByRole("tabpanel", { name: l.settings }).getByText(l.importing)).toBeVisible();
        expect(pluggyCdn.requests).toEqual(["GET /pluggy-connect.js"]);
        const script = page.locator("script[src*='pluggy']");
        await expect(script).toHaveAttribute("integrity", pluggyConnectSri);
        await expect(script).toHaveAttribute("crossorigin", "anonymous");
        expect(await page.evaluate(() => (window as never as Record<string, unknown>).__pluggyOptions)).toEqual({
          connectToken: "connect-token-e2e",
          includeSandbox: true,
        });
        const calls = fakeApi.requests.map((r) => `${r.method} ${r.path}`).filter((c) => c.includes("connect-token") || c.includes("/items"));
        expect(calls).toEqual(["POST /me/finance/connect-token", "POST /me/finance/items"]);
        expect(fakeApi.requests.find((r) => r.path === "/me/finance/items")?.body).toEqual({ itemId: "item-abc" });
      });

      test("closing the widget without connecting is calm and registers nothing", async ({ page, baseURL, fakeApi, pluggyCdn }) => {
        void pluggyCdn;
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await page.getByRole("button", { name: l.connect }).click();
        await expect(page.getByText(l.closed)).toBeVisible();
        await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
        expect(fakeApi.requests.some((r) => r.path === "/me/finance/items")).toBe(false);
      });

      test("rejected credentials show a calm message and no widget", async ({ page, baseURL, fakeApi, pluggyCdn }) => {
        fakeApi.override("POST /me/finance/connect-token", { status: 422, body: { error: "pluggy_credentials_rejected" } });
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await page.getByRole("button", { name: l.connect }).click();
        // Every form keeps its own empty live region in the page, so pick the one that has the message.
        await expect(page.getByRole("alert").filter({ hasText: l.rejected })).toBeVisible();
        expect(pluggyCdn.requests).toEqual([]);
      });

      test("removing the credentials asks first", async ({ page, baseURL }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await page.getByRole("button", { name: l.remove, exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: l.cancel }).click();
        await expect(page.getByText(l.saved, { exact: true })).toBeVisible();

        await page.getByRole("button", { name: l.remove, exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: l.removeConfirm }).click();
        await expect(page.getByRole("heading", { name: l.steps })).toBeVisible();
        await expect(page.getByText(l.saved, { exact: true })).toHaveCount(0);
      });

      test("deleting the finance data: cancel keeps it, confirm clears it, and the dialog has the danger action last", async ({ page, baseURL, fakeApi }) => {
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await page.getByRole("button", { name: l.del }).click();
        const dialog = page.getByRole("dialog", { name: l.delTitle });
        await expect(dialog).toContainText(l.stays);

        const cancel = dialog.getByRole("button", { name: l.cancel });
        const confirm = dialog.getByRole("button", { name: l.del });
        const [c, d] = [(await cancel.boundingBox())!, (await confirm.boundingBox())!];
        expect(d.y).toBeGreaterThan(c.y);
        expect(d.width).toBeGreaterThanOrEqual(c.width);

        await cancel.click();
        await expect(dialog).toHaveCount(0);
        expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance")).toBe(false);
        await expect(page.getByText(l.checking, { exact: true })).toBeVisible();

        await page.getByRole("button", { name: l.del }).click();
        await page.getByRole("dialog").getByRole("button", { name: l.del }).click();
        await expect(page.getByRole("heading", { name: l.steps })).toBeVisible();
        expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance")).toBe(true);
        await expect(page.getByText(l.checking, { exact: true })).toHaveCount(0);
      });

      test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await visit(page, new URL("/finances", baseURL!).toString());
        await page.getByRole("tab", { name: l.settings }).click();
        await expect(page.getByText(l.saved, { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    });
  });
}
