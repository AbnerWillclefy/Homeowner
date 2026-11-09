export type SendResult = { kind: "ok" } | { kind: "failed"; reason: string };

/** Sends one at a time, in order: the Day Plan locks the Home per request. A failure does not stop the rest. */
export async function applyInOrder<A>(actions: A[], send: (action: A) => Promise<SendResult>): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const action of actions) {
    try {
      results.push(await send(action));
    } catch {
      results.push({ kind: "failed", reason: "error" });
    }
  }
  return results;
}
