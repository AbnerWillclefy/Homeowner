import type { QueryClient } from "@tanstack/react-query";
import type { Chore } from "../api/api";
import { choresKey } from "../api/queries";
import { removeChore, upsertChore } from "./choreList";

/**
 * Applies a change to the cached Chores. A read of the list that is still running is cancelled first, so its
 * older answer cannot land after this one and bring the old list back. A list that was never loaded, or a cancel
 * that fails, invalidates the list instead, so it is read from the server and shows the change. Never rejects.
 */
async function writeChores(client: QueryClient, update: (chores: Chore[]) => Chore[]): Promise<void> {
  try {
    await client.cancelQueries({ queryKey: choresKey, exact: true });
    const current = client.getQueryData<Chore[]>(choresKey);
    if (current !== undefined) {
      client.setQueryData<Chore[]>(choresKey, update(current));
      return;
    }
  } catch {
    // fall through to the read below
  }
  await client.invalidateQueries({ queryKey: choresKey, exact: true }).catch(() => undefined);
}

/** Puts a Chore the server created or updated into the list: added at the end, or replaced in place. */
export function saveChoreInCache(client: QueryClient, chore: Chore): Promise<void> {
  return writeChores(client, (chores) => upsertChore(chores, chore));
}

/** Takes a deleted Chore out of the list. Called once the 204 arrives; nothing is optimistic. */
export function removeChoreFromCache(client: QueryClient, id: string): Promise<void> {
  return writeChores(client, (chores) => removeChore(chores, id));
}
