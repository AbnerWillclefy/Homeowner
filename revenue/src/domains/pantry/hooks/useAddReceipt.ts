import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer } from "react";
import { addReceipt, matchLine, type FieldCodes, type MatchChoice } from "../api";
import { clearChecked } from "../logic/checked";
import { reduce, START } from "../logic/addReceipt";
import { pantryKey } from "./usePantry";

export type MatchOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };

/**
 * The add-receipt flow: its step, and the two writes. Both refresh the Pantry (bought items come back in stock, and the
 * shopping list reads the same key); a new receipt also clears this device's check-offs, a repeated one does not.
 */
export function useAddReceipt() {
  const client = useQueryClient();
  const [step, dispatch] = useReducer(reduce, START);
  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: pantryKey }), [client]);

  const submit = useCallback(
    async (code: string) => {
      dispatch({ type: "submit" });
      const result = await addReceipt(code);
      if (result.kind === "created") clearChecked();
      if (result.kind === "created" || result.kind === "duplicate") refresh();
      dispatch({ type: "answer", result });
    },
    [refresh],
  );

  const match = useCallback(
    async (receiptId: string, n: number, choice: MatchChoice): Promise<MatchOutcome> => {
      const result = await matchLine(receiptId, n, choice);
      if (result.kind === "fields") return result;
      if (result.kind !== "ok") return { kind: "failed" };
      refresh();
      dispatch({ type: "matched", receipt: result.receipt });
      return { kind: "ok" };
    },
    [refresh],
  );

  return { step, dispatch, submit, match };
}
