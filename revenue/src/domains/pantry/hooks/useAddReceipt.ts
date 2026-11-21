import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer } from "react";
import { addReceipt, matchLine, readPhoto, saveDraft, type FieldCodes, type MatchChoice, type ReadPhotoResult, type ReceiptDraft } from "../api";
import { clearChecked } from "../logic/checked";
import { reduce, START } from "../logic/addReceipt";
import { decodeFile, downsize } from "../logic/downsize";
import { pantryKey } from "./usePantry";

export type MatchOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };

/**
 * The add-receipt flow: its step, and its writes (a pasted code, a photo draft, a line match). The saves refresh the Pantry (bought items come back in stock, and the
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

  // The reading state shows from the moment the file is chosen: decoding a 12 MP photo takes seconds on a slow phone.
  const readFile = useCallback(async (file: File) => {
    dispatch({ type: "photo" });
    let result: ReadPhotoResult = { kind: "error" };
    try {
      const photo = await downsize(await decodeFile(file));
      if (photo) result = await readPhoto(photo);
    } catch {
      // Not an image the browser can decode: the same message as any failed read.
    }
    dispatch({ type: "read", result });
  }, []);

  const confirm = useCallback(
    async (draft: ReceiptDraft) => {
      dispatch({ type: "saveDraft" });
      const result = await saveDraft(draft);
      if (result.kind === "created") clearChecked();
      if (result.kind === "created" || result.kind === "duplicate") refresh();
      dispatch({ type: "drafted", result });
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

  return { step, dispatch, submit, match, readFile, confirm };
}
