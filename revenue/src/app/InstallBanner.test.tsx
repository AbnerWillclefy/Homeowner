import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing";
import { InstallBanner } from "./InstallBanner";
import { INSTALL_DISMISSED_KEY } from "./installPrompt";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function offerInstall() {
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  act(() => void window.dispatchEvent(event));
  return { event, prompt };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("install banner", () => {
  it("shows nothing until the browser offers to install", () => {
    renderApp(<InstallBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears on beforeinstallprompt and installs on tap", async () => {
    renderApp(<InstallBanner />);
    const { event, prompt } = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(await screen.findByRole("button", { name: "Instalar" }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is hidden by dismissing, and stays hidden for the session", async () => {
    const first = renderApp(<InstallBanner />);
    offerInstall();
    await userEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(sessionStorage.getItem(INSTALL_DISMISSED_KEY)).not.toBeNull();
    first.unmount();

    renderApp(<InstallBanner />);
    offerInstall();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is in English when the User chose English", async () => {
    renderApp(<InstallBanner />, { locale: "en" });
    offerInstall();
    expect(await screen.findByRole("button", { name: "Install" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
  });

  it("shows the Share then Add to Home Screen steps on an iPhone, with no install button", async () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: IPHONE, languages: ["pt-BR"] });
    renderApp(<InstallBanner />);
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toMatch(/Compartilhar.*Adicionar à Tela de Início/);
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays away on an iPhone once opened from the Home Screen", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: IPHONE, standalone: true, languages: ["pt-BR"] });
    renderApp(<InstallBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  describe.each([["dark", "pt-BR"], ["light", "pt-BR"], ["dark", "en"], ["light", "en"]] as const)("%s %s", (theme, locale) => {
    it("has no axe violations", async () => {
      renderApp(<InstallBanner />, { theme, locale });
      offerInstall();
      await screen.findByRole("status");
      const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
      expect(violations.map((v) => v.id)).toEqual([]);
    });
  });
});
