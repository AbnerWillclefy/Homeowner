import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";
import type { Turn } from "./logic/conversation";
import type { ScreenKey } from "./logic/screenKeys";

export interface AskBody {
  screen: ScreenKey;
  locale: "pt-BR" | "en";
  messages: Turn[];
}

export type AskResult = { kind: "answer"; answer: string; remaining: number } | { kind: "limit" } | { kind: "unavailable" };

const UNAVAILABLE: AskResult = { kind: "unavailable" };

/** `POST /me/finance/chat`. Never throws: a network error, a 5xx and a body that does not parse are all `unavailable`. */
export async function ask(body: AskBody, client: AxiosInstance = apiClient): Promise<AskResult> {
  try {
    const response = await client.post<unknown>("/me/finance/chat", body);
    const data = response.data;
    if (response.status === 429) return typeof data === "object" && data !== null && (data as { error?: unknown }).error === "chat_daily_limit" ? { kind: "limit" } : UNAVAILABLE;
    if (response.status !== 200 || typeof data !== "object" || data === null) return UNAVAILABLE;
    const { answer, remaining } = data as { answer?: unknown; remaining?: unknown };
    return typeof answer === "string" && typeof remaining === "number" && Number.isInteger(remaining) && remaining >= 0 ? { kind: "answer", answer, remaining } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
