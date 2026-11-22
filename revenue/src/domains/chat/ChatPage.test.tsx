import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Link, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../testing";
import * as api from "./api";
import type { AskResult } from "./api";
import * as goalsApi from "../goals/api";
import { savingsKey } from "../goals/hooks/useSavings";
import { en, ptBR } from "../../shared/i18n/catalogs";
import { SCREEN_KEYS } from "./logic/screenKeys";
import { suggestionsFor } from "./logic/suggestions";
import { ChatPage } from "./ChatPage";

vi.mock("../goals/api", async (original) => ({ ...(await original<typeof import("../goals/api")>()), getSavings: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), ask: vi.fn() }));

const ask = vi.mocked(api.ask);
const answer = (text: string, remaining = 17): AskResult => ({ kind: "answer", answer: text, remaining });
// jsdom has no layout, so it cannot check contrast (Bedrock's tokens.test.ts does); the page is not a whole document, so no landmarks.
const AXE = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

const width = (desktop: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} }));
const open = (options: Parameters<typeof renderApp>[1] = {}) =>
  renderApp(
    <Routes>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/bills" element={<Link to="/chat?from=bills">to chat</Link>} />
    </Routes>,
    { path: "/chat?from=bills", locale: "en", ...options },
  );
const input = () => screen.getByRole<HTMLInputElement>("textbox", { name: /question|pergunta/i });
const send = () => screen.getByRole<HTMLButtonElement>("button", { name: /^(Send|Enviar)$/ });
const type = async (text: string) => {
  await userEvent.clear(input());
  // paste: typing 500 characters one by one is slow and says nothing more
  await userEvent.click(input());
  await userEvent.paste(text);
};
const say = async (text: string) => {
  await type(text);
  await userEvent.click(send());
};

beforeEach(() => {
  localStorage.clear();
  ask.mockReset();
  width(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("layout and states", () => {
  it("shows the empty state alone, with no request", () => {
    open();
    expect(screen.getByText("Ask about your money")).toBeTruthy();
    expect(screen.getByText("I answer from your transactions, goals and pantry.")).toBeTruthy();
    expect(screen.queryByText(/left today/)).toBeNull();
    expect(send().disabled).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("speaks pt-BR first", () => {
    open({ locale: "pt-BR" });
    expect(screen.getByRole("heading", { name: "Perguntar" })).toBeTruthy();
    expect(screen.getByText("Respondo com base nos seus lançamentos, objetivos e despensa.")).toBeTruthy();
    expect(screen.getByText("Pode errar. Não é conselho financeiro.")).toBeTruthy();
  });

  it("has the way back as a link on a phone, and the subtitle instead on desktop", () => {
    open();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/bills");
    expect(screen.queryByText("Ask about your money", { selector: "p.text-text-muted" })).toBeNull();
  });

  it("makes the field and the send button both 48 high", () => {
    open();
    // twMerge does not drop the base h-control-md, so the important class is what makes the field 48 on desktop.
    expect(input().className).toContain("!h-control-lg");
    expect(send().className).toContain("h-control-lg");
  });

  it("keeps a long unbroken answer inside its bubble", async () => {
    ask.mockResolvedValue(answer("x".repeat(200)));
    open();
    await say("Hi");
    expect(screen.getByText("x".repeat(200)).className).toContain("[overflow-wrap:anywhere]");
  });

  it("has no back link and shows the subtitle on desktop", () => {
    width(true);
    open();
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
    expect(screen.getByText("Ask about your money", { selector: "p.text-text-muted" })).toBeTruthy();
  });

  it("shows the question at once, then a working state with the input and send disabled", async () => {
    let finish!: (r: AskResult) => void;
    ask.mockReturnValue(new Promise<AskResult>((resolve) => (finish = resolve)));
    open();
    await say("Where did I spend most?");
    expect(screen.getByText("Where did I spend most?")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Thinking…");
    expect(input().disabled).toBe(true);
    expect(send().disabled).toBe(true);
    await act(async () => finish(answer("Groceries.")));
    expect(screen.getByText("Groceries.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(input().disabled).toBe(false);
  });

  it("keeps focus in the input after an answer", async () => {
    ask.mockResolvedValue(answer("Groceries."));
    open();
    await say("Hi");
    await screen.findByText("Groceries.");
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it("has no accessibility violations with an answer on screen", async () => {
    ask.mockResolvedValue(answer("Groceries."));
    const { container } = open();
    await say("Hi");
    await screen.findByText("Groceries.");
    const result = await axe.run(container, AXE);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("plain text", () => {
  it("renders an answer holding a link, an image tag and Markdown as literal text", async () => {
    const evil = "[x](http://evil) <img src=x onerror=alert(1)> **b**";
    ask.mockResolvedValue(answer(evil));
    const { container } = open();
    await say("Hi");
    expect(await screen.findByText(evil)).toBeTruthy();
    expect(container.querySelector("a[href*=evil]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
  });

  it("renders what the User typed as text too", async () => {
    ask.mockResolvedValue(answer("ok"));
    const { container } = open();
    await say("<b>hi</b>");
    expect(await screen.findByText("<b>hi</b>")).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
  });
});

describe("the request", () => {
  it("carries the screen from `from`, the locale and the earlier turns", async () => {
    ask.mockResolvedValueOnce(answer("A1")).mockResolvedValueOnce(answer("A2"));
    open({ locale: "pt-BR", path: "/chat?from=card_bills" });
    await say("Q1");
    await screen.findByText("A1");
    await say("Q2");
    await screen.findByText("A2");
    expect(ask.mock.calls[0]![0]).toEqual({ screen: "card_bills", locale: "pt-BR", messages: [{ role: "user", text: "Q1" }] });
    expect(ask.mock.calls[1]![0]).toEqual({
      screen: "card_bills",
      locale: "pt-BR",
      messages: [{ role: "user", text: "Q1" }, { role: "assistant", text: "A1" }, { role: "user", text: "Q2" }],
    });
  });

  it("sends `other` for a missing or unknown from", async () => {
    ask.mockResolvedValue(answer("A"));
    open({ path: "/chat?from=pantry" });
    await say("Q");
    await screen.findByText("A");
    expect(ask.mock.calls[0]![0].screen).toBe("other");
  });

  it("sends at most 11 messages, starting with a user turn, dropping old turns in pairs", async () => {
    ask.mockImplementation(async (body) => answer(`A${body.messages.length}`));
    open();
    for (let i = 1; i <= 8; i++) {
      await say(`Q${i}`);
      await waitFor(() => expect(ask).toHaveBeenCalledTimes(i));
      await waitFor(() => expect(input().disabled).toBe(false));
    }
    const sizes = ask.mock.calls.map(([body]) => body.messages.length);
    expect(sizes).toEqual([1, 3, 5, 7, 9, 11, 11, 11]);
    const last = ask.mock.calls[7]![0].messages;
    expect(last[0]).toEqual({ role: "user", text: "Q3" });
    expect(last.at(-1)).toEqual({ role: "user", text: "Q8" });
    for (const [body] of ask.mock.calls) expect(body.messages[0]!.role).toBe("user");
  });

  it("trims the question and does not send an empty one", async () => {
    ask.mockResolvedValue(answer("A"));
    open();
    await type("   ");
    expect(send().disabled).toBe(true);
    await userEvent.type(input(), "{Enter}");
    expect(ask).not.toHaveBeenCalled();
    await type("  Q  ");
    await userEvent.click(send());
    await screen.findByText("A");
    expect(ask.mock.calls[0]![0].messages).toEqual([{ role: "user", text: "Q" }]);
  });

  it("refuses 501 code points in the form and sends 500", async () => {
    ask.mockResolvedValue(answer("A"));
    open();
    await type("😀".repeat(501));
    expect(screen.getByRole("alert").textContent).toBe("500 character limit");
    expect(send().disabled).toBe(true);
    await userEvent.type(input(), "{Enter}");
    expect(ask).not.toHaveBeenCalled();
    await type("😀".repeat(500));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("500/500")).toBeTruthy();
    await userEvent.click(send());
    await screen.findByText("A");
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("shows the counter from 450 characters, and not before", async () => {
    open();
    await type("a".repeat(449));
    expect(screen.queryByText("449/500")).toBeNull();
    await type("a".repeat(450));
    expect(screen.getByText("450/500")).toBeTruthy();
  });
});

describe("clearing", () => {
  it("is empty after leaving and coming back, with nothing chat-related cached", async () => {
    ask.mockResolvedValue(answer("Secret answer"));
    const { client } = open();
    await say("Secret question");
    await screen.findByText("Secret answer");
    await userEvent.click(screen.getByRole("link", { name: "Back" }));
    await userEvent.click(screen.getByRole("link", { name: "to chat" }));
    expect(screen.queryByText("Secret question")).toBeNull();
    expect(screen.queryByText("Secret answer")).toBeNull();
    expect(screen.getByText("I answer from your transactions, goals and pantry.")).toBeTruthy();
    expect(screen.queryByText(/left today/)).toBeNull();
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(client.getMutationCache().getAll()).toEqual([]);
  });

  it("clears the mutation cache once it settles and the page unmounts", async () => {
    ask.mockResolvedValue(answer("A"));
    const { client, unmount } = open();
    await say("Q");
    await screen.findByText("A");
    expect(client.getQueryCache().getAll()).toEqual([]);
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toEqual([]));
  });
});

describe("limit and unavailable", () => {
  it("shows the localized limit as a notice, not a reply, and disables the input", async () => {
    ask.mockResolvedValue({ kind: "limit" });
    open({ locale: "pt-BR" });
    await say("Oi");
    const notice = await screen.findByText("Você usou suas 20 perguntas de hoje. Volte amanhã.");
    expect(notice.closest("p")).toBeNull();
    expect(input().disabled).toBe(true);
    expect(send().disabled).toBe(true);
    expect(screen.queryByText("Oi")).toBeNull();
  });

  it("shows the limit in English", async () => {
    ask.mockResolvedValue({ kind: "limit" });
    open();
    await say("Hi");
    expect(await screen.findByText("You've used your 20 questions today. Come back tomorrow.")).toBeTruthy();
  });

  it.each([{ locale: "pt-BR" as const, message: "Não foi possível responder agora", retry: "Tentar de novo" }, { locale: "en" as const, message: "Couldn't answer right now", retry: "Try again" }])(
    "shows unavailable with Retry in $locale, keeps the question, and Retry resends it",
    async ({ locale, message, retry }) => {
      ask.mockResolvedValueOnce({ kind: "unavailable" }).mockResolvedValueOnce(answer("Back"));
      open({ locale });
      await say("Q");
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(message);
      expect(screen.getByText("Q")).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: retry }));
      await screen.findByText("Back");
      expect(ask).toHaveBeenCalledTimes(2);
      expect(ask.mock.calls[1]![0]).toEqual(ask.mock.calls[0]![0]);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("replaces a failed question when a new one is asked instead", async () => {
    ask.mockResolvedValueOnce({ kind: "unavailable" }).mockResolvedValueOnce(answer("A2"));
    open();
    await say("Q1");
    await screen.findByRole("alert");
    await say("Q2");
    await screen.findByText("A2");
    expect(ask.mock.calls[1]![0].messages).toEqual([{ role: "user", text: "Q2" }]);
    expect(screen.queryByText("Q1")).toBeNull();
  });
});

describe("remaining", () => {
  it("is absent before the first answer, plural after it", async () => {
    ask.mockResolvedValue(answer("A", 17));
    open();
    expect(screen.queryByText(/left today/)).toBeNull();
    await say("Q");
    expect(await screen.findByText("17 questions left today")).toBeTruthy();
  });

  it("is singular for one, in both locales", async () => {
    ask.mockResolvedValue(answer("A", 1));
    open();
    await say("Q");
    expect(await screen.findByText("1 question left today")).toBeTruthy();
  });

  it.each([
    { remaining: 17, text: "Restam 17 perguntas hoje" },
    { remaining: 1, text: "Resta 1 pergunta hoje" },
    { remaining: 0, text: "Restam 0 perguntas hoje" },
  ])("reads $text in pt-BR", async ({ remaining, text }) => {
    ask.mockResolvedValue(answer("A", remaining));
    open({ locale: "pt-BR" });
    await say("Q");
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("goes while the next question is pending", async () => {
    ask.mockResolvedValueOnce(answer("A", 5)).mockReturnValueOnce(new Promise(() => {}));
    open();
    await say("Q1");
    await screen.findByText("5 questions left today");
    await say("Q2");
    expect(screen.queryByText(/left today/)).toBeNull();
  });
});

const suggestionButtons = () => within(screen.getByRole("group", { name: "Suggestions" })).getAllByRole("button");
const SAVINGS = { goals: [{ id: "g1", name: "Viagem Japão" }, { id: "g2", name: "Carro" }] } as unknown as import("../goals/api").Savings;

describe("suggestions", () => {
  it("shows 2 or 3 suggestions from the catalog for every screen key", () => {
    expect(SCREEN_KEYS).toHaveLength(11);
    for (const key of SCREEN_KEYS) {
      const { unmount } = open({ path: `/chat?from=${key}` });
      const expected = suggestionsFor(key, undefined).map((s) => en[s.key]);
      expect(expected.length).toBeGreaterThanOrEqual(2);
      expect(suggestionButtons().map((b) => b.textContent), key).toEqual(expected);
      unmount();
    }
  });

  it("names the first Goal when the savings are cached", () => {
    open({ path: "/chat?from=goals", seed: (c) => c.setQueryData(savingsKey, SAVINGS) });
    expect(suggestionButtons()[0]!.textContent).toBe("When do I reach Viagem Japão?");
    expect(goalsApi.getSavings).not.toHaveBeenCalled();
  });

  it("asks a generic Goal question, and fetches nothing, without the cache", () => {
    open({ path: "/chat?from=goals" });
    expect(suggestionButtons()[0]!.textContent).toBe(en["chat.suggest.goals.1"]);
    expect(goalsApi.getSavings).not.toHaveBeenCalled();
  });

  it("asks a generic Goal question when the cache has no Goals", () => {
    open({ path: "/chat?from=goals", seed: (c) => c.setQueryData(savingsKey, { goals: [] }) });
    expect(suggestionButtons()[0]!.textContent).toBe(en["chat.suggest.goals.1"]);
  });

  it("shows the generic set for an unknown or missing from", () => {
    const generic = suggestionsFor("other", undefined).map((s) => en[s.key]);
    for (const path of ["/chat?from=pantry", "/chat"]) {
      const { unmount } = open({ path });
      expect(suggestionButtons().map((b) => b.textContent)).toEqual(generic);
      unmount();
    }
  });

  it("speaks pt-BR first", () => {
    open({ locale: "pt-BR", path: "/chat?from=bills" });
    const group = screen.getByRole("group", { name: "Sugestões" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([ptBR["chat.suggest.bills.1"], ptBR["chat.suggest.bills.2"]]);
  });

  it("sends the same request as typing the text, then hides the suggestions", async () => {
    ask.mockResolvedValue(answer("A"));
    open({ path: "/chat?from=bills" });
    const text = en["chat.suggest.bills.2"];
    await userEvent.click(screen.getByRole("button", { name: text }));
    await screen.findByText("A");
    expect(screen.queryByRole("group", { name: "Suggestions" })).toBeNull();
    cleanup();
    open({ path: "/chat?from=bills" });
    await say(text);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[0]![0]).toEqual(ask.mock.calls[1]![0]);
    expect(ask.mock.calls[0]![0].messages).toEqual([{ role: "user", text }]);
  });
});
