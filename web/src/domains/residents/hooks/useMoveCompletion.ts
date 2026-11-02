import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveCompletion } from "../api/api";
import { writeMovedCompletion } from "../logic/completionCache";

/**
 * Moves one of the caller's Completions to an instant. `move` resolves with the API's answer (it never throws),
 * and on `ok` the caches follow (see `writeMovedCompletion`). `pending` is true while the call runs.
 */
export function useMoveCompletion() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, completedAt }: { id: string; completedAt: string }) => moveCompletion(id, completedAt),
    onSuccess: (result) => (result.kind === "ok" ? writeMovedCompletion(client, result.resident) : undefined),
  });
  return { move: mutation.mutateAsync, pending: mutation.isPending };
}
