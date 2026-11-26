import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { moveCompletion } from "../api/api";
import { writeMovedCompletion } from "../logic/completionCache";

/**
 * Moves one of the caller's Completions to an instant. `move` resolves with the API's answer (it never throws),
 * and on `ok` the caches follow (see `writeMovedCompletion`). It is a plain call, not a mutation of this
 * component: Desfazer sends it again after the screen that asked may be gone.
 */
export function useMoveCompletion() {
  const client = useQueryClient();
  const move = useCallback(
    async ({ id, completedAt }: { id: string; completedAt: string }) => {
      const result = await moveCompletion(id, completedAt);
      if (result.kind === "ok") await writeMovedCompletion(client, result.resident);
      return result;
    },
    [client],
  );
  return { move };
}
