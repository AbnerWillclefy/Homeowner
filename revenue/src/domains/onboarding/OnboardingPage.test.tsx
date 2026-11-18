import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as settings from "../settings/api";
import * as sources from "../sources/api";
import type { SourcesStatus } from "../sources/api";
import type { PluggyOptions } from "../sources/logic/pluggyConnect";
import { ONBOARDING_DONE_KEY } from "./logic/onboardingDone";
import { OnboardingPage } from "./OnboardingPage";

vi.mock("../settings/api", async (original) => ({
  ...(await original<typeof import("../settings/api")>()),
  getMonthlyIncome: vi.fn(), getCredentialsSaved: vi.fn(), putCredentials: vi.fn(), putIncome: vi.fn(),
}));
vi.mock("../sources/api", async (original) => ({ ...(await original<typeof import("../sources/api")>()), getSources: vi.fn(), createConnectToken: vi.fn(), registerItem: vi.fn() }));
let widget: PluggyOptions;
vi.mock("../sources/logic/pluggyConnect", () => ({ openPluggyConnect: vi.fn(async (o: PluggyOptions) => void (widget = o)) }));

const ok = { kind: "ok" } as const;
const NONE: SourcesStatus = { sources: [], items: [], importing: false, lastSyncedAt: null };
const WITH_BANK: SourcesStatus = { ...NONE, items: [{ id: "i1", bankName: "Nubank", status: "ok", products: 1 }], importing: true };

beforeEach(() => {
  widget = undefined as never;
  localStorage.clear();
  vi.mocked(settings.getCredentialsSaved).mockResolvedValue(false);
  vi.mocked(settings.getMonthlyIncome).mockResolvedValue(null);
  vi.mocked(settings.putCredentials).mockReset().mockResolvedValue(ok);
  vi.mocked(settings.putIncome).mockReset().mockResolvedValue(ok);
  vi.mocked(sources.getSources).mockResolvedValue(NONE);
  vi.mocked(sources.createConnectToken).mockReset().mockResolvedValue({ kind: "ok", connectToken: "tok", includeSandbox: false });
  vi.mocked(sources.registerItem).mockReset().mockResolvedValue({ kind: "ok", status: WITH_BANK });
});

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/" element={<p>the overview</p>} />
    </Routes>,
    { locale: "en", path: "/onboarding", ...options },
  );
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });
const skip = () => userEvent.click(screen.getByRole("button", { name: /^(Skip|Pular)$/ }));

describe("OnboardingPage", () => {
  it("starts on the credentials step and says why it asks", async () => {
    open();
    expect(await heading("Connect your Pluggy account")).toBeTruthy();
    expect(screen.getByText(/Revenue reads your banks through Open Finance/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Where do I find these/ }).getAttribute("rel")).toContain("noopener");
  });

  it("saves the credentials and moves to the banks, in pt-BR too", async () => {
    open({ locale: "pt-BR" });
    await userEvent.type(await screen.findByLabelText("Client ID"), " id-1 ");
    await userEvent.type(screen.getByLabelText("Client Secret"), "secret-1");
    await userEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));
    expect(await heading("Conecte seus bancos")).toBeTruthy();
    expect(settings.putCredentials).toHaveBeenCalledWith("id-1", "secret-1");
    expect(screen.getByText("Passo 2 de 4")).toBeTruthy();
  });

  it("keeps the User on the credentials step with the reason when Pluggy refuses them", async () => {
    vi.mocked(settings.putCredentials).mockResolvedValue({ kind: "rejected" });
    open();
    await userEvent.type(await screen.findByLabelText("Client ID"), "id");
    await userEvent.type(screen.getByLabelText("Client Secret"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Pluggy refused these credentials. Check them and try again.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Connect your Pluggy account" })).toBeTruthy();
  });

  it("offers Continue instead of the form when credentials are already saved", async () => {
    vi.mocked(settings.getCredentialsSaved).mockResolvedValue(true);
    open();
    expect(await screen.findByText(/Credentials saved/)).toBeTruthy();
    expect(screen.queryByLabelText("Client ID")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await heading("Connect your banks")).toBeTruthy();
  });

  it("skips each step to the next, then finishes on the Overview with the flag stored", async () => {
    open();
    await heading("Connect your Pluggy account");
    await skip();
    await heading("Connect your banks");
    await skip();
    await heading("How much comes in each month");
    await skip();
    expect(await heading("All set")).toBeTruthy();
    expect(screen.getByText("You skipped connecting banks. Connect one whenever you like in Sources.")).toBeTruthy();
    expect(localStorage.getItem(ONBOARDING_DONE_KEY)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Go to the Overview" }));
    expect(await screen.findByText("the overview")).toBeTruthy();
    expect(localStorage.getItem(ONBOARDING_DONE_KEY)).toBe("1");
    expect(settings.putCredentials).not.toHaveBeenCalled();
    expect(settings.putIncome).not.toHaveBeenCalled();
  });

  it("moves focus to the new step's heading", async () => {
    open();
    await heading("Connect your Pluggy account");
    await skip();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Connect your banks" })));
  });

  it("goes back a step", async () => {
    open();
    await heading("Connect your Pluggy account");
    await skip();
    await heading("Connect your banks");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await heading("Connect your Pluggy account")).toBeTruthy();
  });

  describe("banks", () => {
    const toBanks = async () => {
      open();
      await heading("Connect your Pluggy account");
      await skip();
      await heading("Connect your banks");
    };

    it("connects a bank through Pluggy Connect and lists it", async () => {
      await toBanks();
      expect(screen.getByText("No bank connected yet.")).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: "Connect a bank" }));
      await waitFor(() => expect(widget).toBeTruthy());
      // The refetch the connect marks stale now sees the bank.
      vi.mocked(sources.getSources).mockResolvedValue(WITH_BANK);
      await widget.onSuccess({ item: { id: "item-1" } } as never);
      expect(sources.registerItem).toHaveBeenCalledWith("item-1");
      expect(await screen.findByText("Nubank")).toBeTruthy();
      expect(screen.getByText("Connected")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Connect another bank" })).toBeTruthy();
    });

    it("sends a 409 (no credentials) back to the credentials step", async () => {
      vi.mocked(sources.createConnectToken).mockResolvedValue({ kind: "no-credentials" });
      await toBanks();
      await userEvent.click(screen.getByRole("button", { name: "Connect a bank" }));
      expect(await screen.findByText(/Before connecting a bank, save your MeuPluggy credentials/)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: "Save credentials" }));
      expect(await heading("Connect your Pluggy account")).toBeTruthy();
    });

    it("says a refused credential needs fixing in step 1 too", async () => {
      vi.mocked(sources.createConnectToken).mockResolvedValue({ kind: "rejected" });
      await toBanks();
      await userEvent.click(screen.getByRole("button", { name: "Connect a bank" }));
      expect(await screen.findByRole("button", { name: "Save credentials" })).toBeTruthy();
    });

    it("words another failure and stays on the step", async () => {
      vi.mocked(sources.createConnectToken).mockResolvedValue({ kind: "unavailable" });
      await toBanks();
      await userEvent.click(screen.getByRole("button", { name: "Connect a bank" }));
      expect(await screen.findByText(/Pluggy/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Save credentials" })).toBeNull();
    });
  });

  describe("income", () => {
    const toIncome = async () => {
      open();
      await heading("Connect your Pluggy account");
      await skip();
      await skip();
      await heading("How much comes in each month");
    };

    it("explains what the income turns on, saves it and moves on", async () => {
      await toIncome();
      expect(screen.getByText(/Leftover and how much you can spend per day/)).toBeTruthy();
      await userEvent.type(screen.getByLabelText("How much comes in each month"), "5000");
      await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
      expect(await heading("All set")).toBeTruthy();
      expect(settings.putIncome).toHaveBeenCalledWith(500_000);
    });

    it("refuses an empty income without writing", async () => {
      await toIncome();
      await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
      expect(await screen.findByText("Enter your monthly income, for example 5,000.00.")).toBeTruthy();
      expect(settings.putIncome).not.toHaveBeenCalled();
    });

    it("keeps what was typed when the save fails", async () => {
      vi.mocked(settings.putIncome).mockResolvedValue({ kind: "failed" } as never);
      await toIncome();
      const field = screen.getByLabelText("How much comes in each month") as HTMLInputElement;
      await userEvent.type(field, "5000");
      await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
      expect(await screen.findByText(/We could not|Could not|did not/i)).toBeTruthy();
      expect(field.value).toContain("5");
      expect(screen.getByRole("heading", { level: 1, name: "How much comes in each month" })).toBeTruthy();
    });
  });

  describe("done", () => {
    it("counts the banks, explains the first import and says where to do the rest", async () => {
      vi.mocked(sources.getSources).mockResolvedValue(WITH_BANK);
      open();
      await heading("Connect your Pluggy account");
      await skip();
      await skip();
      await skip();
      expect(await screen.findByText("1 bank connected.")).toBeTruthy();
      expect(screen.getByText(/runs every hour and brings up to 12 months/)).toBeTruthy();
      expect(screen.getByText("Credentials and income live in Settings; banks live in Sources.")).toBeTruthy();
    });

    it("uses the plural for two banks", async () => {
      vi.mocked(sources.getSources).mockResolvedValue({ ...WITH_BANK, items: [...WITH_BANK.items, { id: "i2", bankName: "Itaú", status: "ok", products: 2 }] });
      open({ locale: "pt-BR" });
      await heading("Conecte sua conta do Pluggy");
      await skip();
      await skip();
      await skip();
      expect(await screen.findByText("2 bancos conectados.")).toBeTruthy();
    });
  });

  describe.each([
    ["dark", "pt-BR"],
    ["light", "pt-BR"],
    ["dark", "en"],
    ["light", "en"],
  ] as const)("accessibility, %s %s", (theme, locale) => {
    it("has no axe violations on any step", async () => {
      vi.mocked(sources.getSources).mockResolvedValue(WITH_BANK);
      open({ theme, locale });
      const check = async () => {
        // jsdom has no layout, so contrast is checked by Bedrock's tokens test.
        const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      };
      const skipStep = () => userEvent.click(screen.getByRole("button", { name: locale === "en" ? "Skip" : "Pular" }));
      await screen.findByLabelText("Client ID");
      await check();
      await skipStep();
      await screen.findByText("Nubank");
      await check();
      await skipStep();
      await screen.findByRole("textbox");
      await check();
      await skipStep();
      await screen.findByText(locale === "en" ? "1 bank connected." : "1 banco conectado.");
      await check();
    });
  });
});
