import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import { browserRemindersDeps } from "./logic/browserDeps";
import type { ReminderAvailability } from "./logic/platform";
import type { RemindersDeps } from "./logic/reminders";
import { SettingsPage } from "./SettingsPage";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getMonthlyIncome: vi.fn(), getCredentialsSaved: vi.fn(), putIncome: vi.fn(), putCredentials: vi.fn(), deleteCredentials: vi.fn(), deleteFinanceData: vi.fn(),
}));
vi.mock("./logic/browserDeps", () => ({ browserRemindersDeps: vi.fn() }));
let availability: ReminderAvailability = { kind: "available" };
vi.mock("./logic/platform", async (original) => ({ ...(await original<typeof import("./logic/platform")>()), reminderAvailability: () => availability }));

// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
const ok = { kind: "ok" } as const;

let subscription: { endpoint: string; unsubscribe: ReturnType<typeof vi.fn> } | null;
let permission: NotificationPermission;
let requestPermission: ReturnType<typeof vi.fn>;
let deps: RemindersDeps;
const deleteSubscription = vi.fn(async () => ok);

beforeEach(() => {
  localStorage.clear();
  availability = { kind: "available" };
  vi.mocked(api.getMonthlyIncome).mockResolvedValue(null);
  vi.mocked(api.getCredentialsSaved).mockResolvedValue(false);
  vi.mocked(api.putIncome).mockResolvedValue(ok);
  vi.mocked(api.deleteFinanceData).mockResolvedValue(ok);
  subscription = null;
  permission = "default";
  requestPermission = vi.fn(async () => "granted" as NotificationPermission);
  deleteSubscription.mockClear();
  const created = { endpoint: "https://push.example/new", options: { applicationServerKey: null }, toJSON: () => ({ endpoint: "https://push.example/new", keys: { p256dh: "p", auth: "a" } }), unsubscribe: vi.fn(async () => true) };
  deps = {
    getPermission: () => permission,
    requestPermission: requestPermission as RemindersDeps["requestPermission"],
    getRegistration: async () => ({
      pushManager: {
        getSubscription: async () => (subscription ? ({ ...subscription, options: { applicationServerKey: null }, toJSON: created.toJSON } as never) : null),
        subscribe: vi.fn(async () => {
          subscription = created;
          return created;
        }),
      },
    }),
    getVapidPublicKey: async () => ({ kind: "ok", key: "AQID" }),
    saveSubscription: vi.fn(async () => ok),
    deleteSubscription,
    userAgent: "UA",
  };
  vi.mocked(browserRemindersDeps).mockImplementation(() => deps);
});

const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/onboarding" element={<p>first run</p>} />
    </Routes>,
    { path: "/settings", locale: "en", ...options },
  );

describe("monthly income", () => {
  it("shows the saved income and sends a new one", async () => {
    vi.mocked(api.getMonthlyIncome).mockResolvedValue(500000);
    open();
    const field = await screen.findByLabelText("How much comes in each month");
    expect((field as HTMLInputElement).value).toBe("5,000.00");
    await userEvent.clear(field);
    await userEvent.type(field, "6000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.putIncome).toHaveBeenCalledWith(600000));
    expect(await screen.findByText("Income saved.")).toBeTruthy();
  });

  it("refuses an empty field and zero without calling the API", async () => {
    open({ locale: "pt-BR" });
    const save = await screen.findByRole("button", { name: "Salvar" });
    await userEvent.click(save);
    expect(await screen.findByText("Digite sua renda mensal, por exemplo 5.000,00.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Quanto entra por mês"), "0");
    await userEvent.click(save);
    expect(await screen.findByText("A renda mensal precisa ser maior que zero.")).toBeTruthy();
    expect(api.putIncome).not.toHaveBeenCalled();
  });

  it("keeps the typed amount when saving fails", async () => {
    vi.mocked(api.putIncome).mockResolvedValue({ kind: "error" } as never);
    open();
    const field = await screen.findByLabelText("How much comes in each month");
    await userEvent.type(field, "6000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("We could not save. Try again in a moment.")).toBeTruthy();
    expect((screen.getByLabelText("How much comes in each month") as HTMLInputElement).value).toBe("6,000.00");
  });

  it("clears the income", async () => {
    vi.mocked(api.getMonthlyIncome).mockResolvedValue(500000);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));
    await waitFor(() => expect(api.putIncome).toHaveBeenCalledWith(null));
  });
});

describe("delete my data", () => {
  it("lists what goes, deletes after the confirmation and goes to onboarding", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Delete everything" }));
    expect(screen.getByText(/Transactions, Sources, Bills to pay, Goals, Investments, balances, value history/)).toBeTruthy();
    expect(api.deleteFinanceData).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete my data" }));
    expect(await screen.findByText("first run")).toBeTruthy();
    expect(api.deleteFinanceData).toHaveBeenCalledOnce();
  });

  it("says so when it fails and stays here", async () => {
    vi.mocked(api.deleteFinanceData).mockResolvedValue({ kind: "error" });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Delete everything" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete my data" }));
    expect(await screen.findByText("We could not delete. Nothing was removed; try again.")).toBeTruthy();
  });
});

describe("credentials", () => {
  it("asks for them when none are saved, and saves", async () => {
    vi.mocked(api.putCredentials).mockResolvedValue(ok);
    open();
    await userEvent.type(await screen.findByLabelText("Client ID"), "id");
    await userEvent.type(screen.getByLabelText("Client Secret"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Save credentials" }));
    await waitFor(() => expect(api.putCredentials).toHaveBeenCalledWith("id", "secret"));
  });

  it("says so when reading them fails, not that none are saved", async () => {
    vi.mocked(api.getCredentialsSaved).mockRejectedValue(new Error("503"));
    open();
    expect(await screen.findByText("Could not read your credentials. Reload the page.")).toBeTruthy();
    expect(screen.queryByText(/None saved/)).toBeNull();
  });

  it("says when Pluggy refuses them", async () => {
    vi.mocked(api.putCredentials).mockResolvedValue({ kind: "rejected" });
    open();
    await userEvent.type(await screen.findByLabelText("Client ID"), "id");
    await userEvent.type(screen.getByLabelText("Client Secret"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Save credentials" }));
    expect(await screen.findByText("Pluggy refused these credentials. Check them and try again.")).toBeTruthy();
  });

  it("removes saved credentials after a confirmation", async () => {
    vi.mocked(api.getCredentialsSaved).mockResolvedValue(true);
    vi.mocked(api.deleteCredentials).mockResolvedValue(ok);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove credentials" }));
    await waitFor(() => expect(api.deleteCredentials).toHaveBeenCalledOnce());
  });
});

describe("notifications", () => {
  it("is off by default and does not ask for permission on its own", async () => {
    open();
    const toggle = await screen.findByRole("switch", { name: "Bill reminders" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.getByText(/Homeowner will stop sending them/)).toBeTruthy();
  });

  it("asks only when turned on, then registers; turning it off unsubscribes and deletes", async () => {
    open();
    const toggle = await screen.findByRole("switch", { name: "Bill reminders" });
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(deps.saveSubscription).toHaveBeenCalledOnce();
    permission = "granted";
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(deleteSubscription).toHaveBeenCalledWith("https://push.example/new");
  });

  it("shows the switch on when this device is already registered", async () => {
    permission = "granted";
    subscription = { endpoint: "https://push.example/old", unsubscribe: vi.fn(async () => true) };
    open();
    const toggle = await screen.findByRole("switch", { name: "Bill reminders" });
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
  });

  it("explains calmly, in pt-BR, how to allow a blocked browser", async () => {
    permission = "denied";
    open({ locale: "pt-BR" });
    await userEvent.click(await screen.findByRole("switch", { name: "Lembretes de contas" }));
    expect(await screen.findByText(/As notificações estão bloqueadas para o Revenue\. Para ativar, permita Notificações/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Lembretes de contas" }).getAttribute("aria-checked")).toBe("false");
  });

  it("says notifications are unavailable on a 503", async () => {
    deps.getVapidPublicKey = async () => ({ kind: "not-configured" });
    open();
    await userEvent.click(await screen.findByRole("switch", { name: "Bill reminders" }));
    expect(await screen.findByText("Notifications are unavailable right now. Try again later.")).toBeTruthy();
  });

  it("shows the install steps on an iPhone that has not installed the app", async () => {
    availability = { kind: "needs-install" };
    open({ locale: "pt-BR" });
    expect(await screen.findByText(/as notificações só funcionam com o Revenue na Tela de Início/)).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("accessibility", () => {
  it.each([["pt-BR"], ["en"]] as const)("has no violations in %s, in both themes", async (locale) => {
    for (const theme of ["light", "dark"] as const) {
      vi.mocked(api.getMonthlyIncome).mockResolvedValue(500000);
      vi.mocked(api.getCredentialsSaved).mockResolvedValue(true);
      const { container, unmount } = open({ locale, theme });
      await screen.findByRole("switch");
      await screen.findByDisplayValue(/5[.,]000,00|5,000\.00/);
      expect((await axe.run(container, AXE)).violations).toEqual([]);
      unmount();
    }
  });
});
