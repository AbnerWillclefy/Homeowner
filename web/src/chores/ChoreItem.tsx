import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteChore, type Chore, type Failure } from "../api/chores";
import { ButtonRow } from "../components/ui/ButtonRow";
import { CardRow } from "../components/ui/CardRow";
import { CategoryGlyph } from "../components/ui/CategoryGlyph";
import { categoryStyle } from "../components/ui/categoryStyle";
import { PillButton } from "../components/ui/PillButton";
import { useI18n } from "../i18n";
import { categoryLabel, labelText } from "../profile/labels";
import { DELETE_FAILURE_KEY } from "./failureMessages";
import { choreScheduleFacts } from "./facts";

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

/** One Chore in the list as a Category-tinted card, with Edit and a two-step inline Delete (ask, then confirm). */
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

  // An unknown Category gets the neutral style and the name "Other", never its raw id.
  const { id: categoryId } = categoryStyle(chore.category);
  const schedule = choreScheduleFacts(chore, t, locale).join(" · ");

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

  const actions = !confirming && (
    <>
      <PillButton
        variant="secondary"
        icon
        aria-label={t("chores.item.edit.label", { name: chore.name })}
        onClick={onEdit}
      >
        <Pencil size={20} aria-hidden="true" />
      </PillButton>
      <PillButton
        ref={deleteRef}
        variant="secondary"
        icon
        aria-label={t("chores.item.delete.label", { name: chore.name })}
        onClick={() => setRemove({ kind: "confirming" })}
      >
        <Trash2 size={20} aria-hidden="true" />
      </PillButton>
    </>
  );

  return (
    <li>
      <CardRow category={chore.category} glyph={<CategoryGlyph category={chore.category} />} actions={actions}>
        <p className="text-sm font-semibold">{labelText(t, categoryLabel(categoryId))}</p>
        <h3 className="font-semibold">{chore.name}</h3>
        <p>{schedule}</p>

        {confirming && (
          <div role="group" aria-label={t("chores.item.delete.label", { name: chore.name })} className="mt-3 flex flex-col gap-2">
            <p>{t("chores.delete.prompt", { name: chore.name })}</p>
            {remove.kind === "confirming" && remove.failed && (
              <p role="alert" className="font-semibold text-danger">
                {t(DELETE_FAILURE_KEY[remove.failed])}
              </p>
            )}
            <ButtonRow className="justify-end">
              <PillButton ref={keepRef} variant="secondary" disabled={remove.kind === "deleting"} onClick={cancel}>
                {t("chores.delete.cancel")}
              </PillButton>
              <PillButton variant="danger" disabled={remove.kind === "deleting"} onClick={() => void confirmDelete()}>
                {t(remove.kind === "deleting" ? "chores.delete.deleting" : "chores.delete.confirm")}
              </PillButton>
            </ButtonRow>
          </div>
        )}
      </CardRow>
    </li>
  );
}
