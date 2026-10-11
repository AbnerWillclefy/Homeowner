import { useEffect, useRef, useState } from "react";
import { deleteChore, type Chore, type Failure } from "../api/chores";
import { useI18n } from "../i18n";
import { DELETE_FAILURE_KEY } from "./failureMessages";
import { choreFacts } from "./facts";

type DeleteState =
  | { kind: "idle" }
  /** Step two: the Resident has asked to delete and has not yet confirmed. */
  | { kind: "confirming"; failed?: Failure["kind"] }
  | { kind: "deleting" };

interface Props {
  chore: Chore;
  onEdit(): void;
  onDeleted(id: string): void;
}

/** One Chore in the list, with Edit and a two-step inline Delete (ask, then confirm). */
export function ChoreItem({ chore, onEdit, onDeleted }: Props) {
  const { t, locale } = useI18n();
  const [remove, setRemove] = useState<DeleteState>({ kind: "idle" });
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirming = remove.kind !== "idle";

  // Step two lands on the safe choice, and cancelling returns to the button that opened it.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const facts = choreFacts(chore, t, locale);

  async function confirmDelete() {
    setRemove({ kind: "deleting" });
    const result = await deleteChore(chore.id);
    // A Chore that is already gone is the outcome the Resident asked for.
    if (result.kind === "ok" || result.kind === "none") return onDeleted(chore.id);
    setRemove({ kind: "confirming", failed: result.kind });
  }

  function cancel() {
    setRemove({ kind: "idle" });
    // The button is mounted again by the time the browser handles this.
    requestAnimationFrame(() => deleteRef.current?.focus());
  }

  return (
    <li className="list-none ps-0">
      <h3 className="font-semibold">{chore.name}</h3>
      <p className="text-muted">{facts.join(" · ")}</p>

      {!confirming && (
        <>
          <button type="button" className="btn" aria-label={t("chores.item.edit.label", { name: chore.name })} onClick={onEdit}>
            {t("chores.item.edit")}
          </button>
          <button
            ref={deleteRef}
            type="button"
            className="btn"
            aria-label={t("chores.item.delete.label", { name: chore.name })}
            onClick={() => setRemove({ kind: "confirming" })}
          >
            {t("chores.item.delete")}
          </button>
        </>
      )}

      {confirming && (
        <div role="group" aria-label={t("chores.item.delete.label", { name: chore.name })}>
          <p>{t("chores.delete.prompt", { name: chore.name })}</p>
          {remove.kind === "confirming" && remove.failed && (
            <p role="alert" className="text-danger">
              {t(DELETE_FAILURE_KEY[remove.failed])}
            </p>
          )}
          <button ref={keepRef} type="button" className="btn" disabled={remove.kind === "deleting"} onClick={cancel}>
            {t("chores.delete.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={remove.kind === "deleting"}
            onClick={() => void confirmDelete()}
          >
            {t(remove.kind === "deleting" ? "chores.delete.deleting" : "chores.delete.confirm")}
          </button>
        </div>
      )}
    </li>
  );
}
