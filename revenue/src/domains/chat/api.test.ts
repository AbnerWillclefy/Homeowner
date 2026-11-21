import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { ask, type AskBody } from "./api";

const BODY: AskBody = { screen: "bills", locale: "pt-BR", messages: [{ role: "user", text: "Oi" }] };

function setup(status: number, data: unknown, fail = false) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  store.save({ idToken: "id", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config);
    if (fail) throw new Error("offline");
    return { data, status, statusText: "", headers: {}, config };
  };
  const client = createApiClient({ baseUrl: "http://api.test", session: store, refresh: async () => ({ kind: "error" }), now: Date.now, adapter });
  return { client, sent };
}

describe("ask", () => {
  it("posts the conversation and returns the answer with what is left", async () => {
    const { client, sent } = setup(200, { answer: "R$ 10", remaining: 3 });
    expect(await ask(BODY, client)).toEqual({ kind: "answer", answer: "R$ 10", remaining: 3 });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/chat");
    expect(JSON.parse(String(sent[0]!.data))).toEqual(BODY);
  });

  it("accepts an answer with nothing left", async () => {
    expect(await ask(BODY, setup(200, { answer: "", remaining: 0 }).client)).toEqual({ kind: "answer", answer: "", remaining: 0 });
  });

  it("reads the daily limit from a 429 with its code", async () => {
    expect(await ask(BODY, setup(429, { error: "chat_daily_limit" }).client)).toEqual({ kind: "limit" });
  });

  it.each([429, 500, 502, 503, 504])("is unavailable on %i without the limit code", async (status) => {
    expect(await ask(BODY, setup(status, { error: "other" }).client)).toEqual({ kind: "unavailable" });
  });

  it("is unavailable on a network error", async () => {
    expect(await ask(BODY, setup(0, null, true).client)).toEqual({ kind: "unavailable" });
  });

  it.each([
    ["answer is a number", { answer: 1, remaining: 3 }],
    ["answer is missing", { remaining: 3 }],
    ["remaining is a string", { answer: "a", remaining: "3" }],
    ["remaining is missing", { answer: "a" }],
    ["remaining is negative", { answer: "a", remaining: -1 }],
    ["remaining is fractional", { answer: "a", remaining: 1.5 }],
    ["the body is null", null],
    ["the body is a string", "ok"],
  ])("is unavailable when %s", async (_, data) => {
    expect(await ask(BODY, setup(200, data).client)).toEqual({ kind: "unavailable" });
  });
});
