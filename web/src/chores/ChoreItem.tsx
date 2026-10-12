import { CalendarDays, Flag, Pencil, Repeat, Trash2, TrendingUp, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteChore, type Chore, type Failure } from "./api";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { Card } from "../shared/ui/Card";
import { useSubmitOnce } from "../shared/ui/useSubmitOnce";
import { useI18n } from "../shared/i18n";
import { importanceLabel, labelText } from "../profile/labels";
import { Button } from "../shared/ui/Button";
import { effortName } from "./effortLevels";
import { DELETE_FAILURE_KEY } from "./failureMessages";
import { EffortDots, Fact, FactIcon, FactList } from "./FactList";
import { choreWeekdays } from "./facts";
import { intervalText } from "./intervalPresets";

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

/**
 * One Chore in its Category's group: the name with Edit and a two-step inline Delete (ask, then confirm), then
 * its facts. Importance and people show only when they differ from the usual (Normal, one person), as on Today.
 */
export function ChoreItem({ chore, onEdit, onDeleted }: Props) {
  const { t, locale } = useI18n();
  const [remove, setRemove] = useState<DeleteState>({ kind: "idle" });
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirming = remove.kind !== "idle";
  const weekdays = choreWeekdays(chore, locale);

  // Step two lands on the safe choice, and cancelling returns to the button that opened it.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  // The guard ignores a second tap in the same tick, before `deleting` has rendered.
  const { run: confirmDelete } = useSubmitOnce(async () => {
    setRemove({ kind: "deleting" });
    const result = await deleteChore(chore.id);
    // A Chore that is already gone is the outcome the Resident asked for.
    if (result.kind === "ok" || result.kind === "none") return onDeleted(chore.id);
    setRemove({ kind: "confirming", failed: result.kind });
  });

  function cancel() {
    setRemove({ kind: "idle" });
    // The button is mounted again by the time the browser handles this.
    requestAnimationFrame(() => deleteRef.current?.focus());
  }

  return (
    <li className="my-0 list-none">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h4 className="my-0 min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{chore.name}</h4>
          {!confirming && (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" icon aria-label={t("chores.item.edit.label", { name: chore.name })} onClick={onEdit}>
                <Pencil size={20} aria-hidden="true" />
              </Button>
              <Button
                ref={deleteRef}
                variant="secondary"
                icon
                aria-label={t("chores.item.delete.label", { name: chore.name })}
                onClick={() => setRemove({ kind: "confirming" })}
              >
                <Trash2 size={20} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <FactList>
          <Fact icon={<EffortDots effort={chore.baseEffort} />}>
            {t("chores.item.effort", { level: effortName(t, chore.baseEffort) })}
          </Fact>
          <Fact icon={<FactIcon icon={Repeat} />}>{intervalText(t, chore.intervalDays)}</Fact>
          {weekdays && <Fact icon={<FactIcon icon={CalendarDays} />}>{t("chores.item.weekdays", { days: weekdays })}</Fact>}
          {chore.importance !== "normal" && (
            <Fact icon={<FactIcon icon={Flag} />}>{labelText(t, importanceLabel(chore.importance))}</Fact>
          )}
          {chore.people === 2 && <Fact icon={<FactIcon icon={Users} />}>{t("chores.item.people.two")}</Fact>}
          {chore.buildsUp && <Fact icon={<FactIcon icon={TrendingUp} />}>{t("chores.item.buildsUp")}</Fact>}
        </FactList>

        {confirming && (
          <div
            role="group"
            aria-label={t("chores.item.delete.label", { name: chore.name })}
            className="flex flex-col gap-2 border-t border-border/40 pt-3"
          >
            <p className="my-0">{t("chores.delete.prompt", { name: chore.name })}</p>
            {remove.kind === "confirming" && remove.failed && (
              <p role="alert" className="my-0 font-semibold text-danger">
                {t(DELETE_FAILURE_KEY[remove.failed])}
              </p>
            )}
            <ButtonRow className="justify-end">
              <Button ref={keepRef} variant="secondary" disabled={remove.kind === "deleting"} onClick={cancel}>
                {t("chores.delete.cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={remove.kind === "deleting"}
                aria-busy={remove.kind === "deleting"}
                onClick={() => void confirmDelete()}
              >
                {t(remove.kind === "deleting" ? "chores.delete.deleting" : "chores.delete.confirm")}
              </Button>
            </ButtonRow>
          </div>
        )}
      </Card>
    </li>
  );
}
