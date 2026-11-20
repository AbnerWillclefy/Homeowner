export interface Turn {
  role: "user" | "assistant";
  text: string;
}

/** The API takes 12 messages; the newest question counts, so older turns stop at 11. */
export const MAX_MESSAGES = 11;
/** Counted in code points, as the server counts runes. */
export const MAX_QUESTION = 500;

/** The turns to send: the newest at most 11, dropping the oldest question-and-answer pair at a time so the first is a user turn (the API refuses a conversation that starts with the assistant). */
export function requestMessages(turns: readonly Turn[]): Turn[] {
  let from = 0;
  while (turns.length - from > MAX_MESSAGES) from += 2;
  while (turns[from]?.role === "assistant") from += 1;
  return turns.slice(from);
}

export const questionLength = (text: string) => [...text].length;
