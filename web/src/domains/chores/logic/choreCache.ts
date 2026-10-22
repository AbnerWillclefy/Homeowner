import type { QueryClient } from "@tanstack/react-query";
import type { Chore } from "../api/api";
import { choresKey } from "../api/queries";
import { removeChore, upsertChore } from "./choreList";

/**
 * Applies a change to the cached Chores. A read of the list that is still running is cancelled first, so its
 * older answer cannot land after this one and bring the old list back. A list that was never loaded stays unloaded.
 */
async function writeChores(client: QueryClient, update: (chores: Chore[]) => Chore[]): Promise<void> {
  await client.cancelQueries({ queryKey: choresKey, exact: true });
  client.setQueryData<Chore[]>(choresKey, (current) => (current === undefined ? undefined : update(current)));
}

/** Puts a Chore the server created or updated into the list: added at the end, or replaced in place. */
export function saveChoreInCache(client: QueryClient, chore: Chore): Promise<void> {
  return writeChores(client, (chores) => upsertChore(chores, chore));
}

/** Takes a deleted Chore out of the list. Called once the 204 arrives; nothing is optimistic. */
export function removeChoreFromCache(client: QueryClient, id: string): Promise<void> {
  return writeChores(client, (chores) => removeChore(chores, id));
}
