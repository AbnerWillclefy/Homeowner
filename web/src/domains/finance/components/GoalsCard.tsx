import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import type { Goal, GoalInput } from "../api/api";
import type { SavingsOutcome } from "../hooks/useSavings";
import { centsToInput, formatCents } from "../logic/money";
import { monthLabel } from "../logic/month";
import { goalInputOf, moveId } from "../logic/savings";
import { DeleteSavingsDialog } from "./DeleteSavingsDialog";
import { SavingsFormDialog } from "./SavingsFormDialog";

interface Props {
  goals: Goal[];
  save(id: string | null, input: GoalInput): Promise<SavingsOutcome>;
  remove(id: string): Promise<SavingsOutcome>;
  reorder(ids: string[]): Promise<"saved" | "changed" | "failed">;
}

type Direction = "up" | "down";

/**
 * Objetivos. Each row opens its form. Reordering is a mode with Up and Down buttons, never dragging: it is rare, so
 * it is not on every row. After a move, focus stays on the button that was pressed (or on its twin when the Goal
 * reached an end) and a polite line says the new position.
 */
export function GoalsCard({ goals, save, remove, reorder }: Props) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<"failed" | "changed" | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ id: string; direction: Direction } | null>(null);

  // Runs when the list arrives in its new order (the move is optimistic): moving the row can drop focus, so it is put back.
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const same = buttons.current.get(`${target.id}:${target.direction}`);
    const twin = buttons.current.get(`${target.id}:${target.direction === "up" ? "down" : "up"}`);
    (same && !same.disabled ? same : twin)?.focus();
  }, [goals]);

  const open = (goal: Goal | null, from: HTMLElement) => {
    opener.current = from;
    setEditing({ goal });
  };

  async function move(goal: Goal, direction: Direction) {
    const ids = moveId(goals.map((g) => g.id), goal.id, direction);
    setNotice(null);
    setAnnouncement(t("finances.savings.goals.moved", { name: goal.name, position: ids.indexOf(goal.id) + 1, total: ids.length }));
    refocus.current = { id: goal.id, direction };
    const result = await reorder(ids);
    if (result !== "saved") {
      setNotice(result);
      setAnnouncement("");
    }
  }

  return (
    <Card as="section" aria-labelledby="finances-savings-goals" className="mt-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h3 id="finances-savings-goals" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
          {t("finances.savings.goals.title")}
        </h3>
        {goals.length > 1 && !reordering && (
          <Button variant="ghost" className="-me-3 px-3 text-muted" onClick={() => setReordering(true)}>
            {t("finances.savings.goals.reorder")}
          </Button>
        )}
      </div>
      {goals.length === 0 ? (
        <p className="my-0">{t("finances.savings.goals.empty")}</p>
      ) : (
        <p className="my-0 text-sm text-muted">{t("finances.savings.goals.hint")}</p>
      )}
      {notice && (
        <p role="alert" className="my-0 font-semibold">
          {t(notice === "failed" ? "finances.savings.goals.reorderFailed" : "finances.savings.goals.reorderChanged")}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {goals.map((goal, index) => (
          <li key={goal.id} className="m-0 border-t border-chart-track first:border-t-0">
            {reordering ? (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 basis-32 font-bold [overflow-wrap:anywhere]">{goal.name}</span>
                <span className="flex gap-2">
                  {(["up", "down"] as const).map((direction) => (
                    <Button
                      key={direction}
                      ref={(el) => {
                        if (el) buttons.current.set(`${goal.id}:${direction}`, el);
                        else buttons.current.delete(`${goal.id}:${direction}`);
                      }}
                      variant="secondary"
                      disabled={direction === "up" ? index === 0 : index === goals.length - 1}
                      aria-label={t(direction === "up" ? "finances.savings.goals.upLabel" : "finances.savings.goals.downLabel", { name: goal.name })}
                      onClick={() => void move(goal, direction)}
                    >
                      {t(direction === "up" ? "finances.savings.goals.up" : "finances.savings.goals.down")}
                    </Button>
                  ))}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 bg-transparent py-2 text-start text-text"
                onClick={(event) => open(goal, event.currentTarget)}
              >
                <span className="min-w-0">
                  <span className="block font-bold [overflow-wrap:anywhere]">{goal.name}</span>
                  {goal.targetMonth && <span className="block text-sm text-muted">{t("finances.savings.goals.by", { month: monthLabel(goal.targetMonth, locale) })}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-bold">
                  {formatCents(goal.targetCents, locale)}
                  <ChevronRight aria-hidden="true" size={16} className="rtl:rotate-180" />
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {reordering ? (
        <Button className="self-start" onClick={() => setReordering(false)}>
          {t("finances.savings.goals.done")}
        </Button>
      ) : (
        <Button variant="secondary" className="self-start" onClick={(event) => open(null, event.currentTarget)}>
          {t("finances.savings.goals.add")}
        </Button>
      )}
      {editing && <GoalDialog key={editing.goal?.id ?? "new"} goal={editing.goal} save={save} remove={remove} returnFocusRef={opener} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function GoalDialog({
  goal,
  save,
  remove,
  returnFocusRef,
  onClose,
}: {
  goal: Goal | null;
  save: Props["save"];
  remove: Props["remove"];
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [month, setMonth] = useState(goal?.targetMonth ?? "");
  return (
    <>
      <SavingsFormDialog
        title={t(goal ? "finances.savings.goals.editTitle" : "finances.savings.goals.addTitle")}
        returnFocusRef={returnFocusRef}
        onClose={onClose}
        below={
          goal && (
            <Button variant="danger" onClick={() => setDeleting(true)}>
              {t("finances.savings.goals.delete")}
            </Button>
          )
        }
        save={async (data) => {
          const result = goalInputOf({ name: String(data.get("name") ?? ""), target: String(data.get("targetCents") ?? ""), month: String(data.get("targetMonth") ?? "") }, locale);
          if (!result.ok) return { kind: "fields", fields: result.errors };
          return save(goal?.id ?? null, result.input);
        }}
      >
        {(field) => (
          <>
            {field("name", t("finances.savings.goals.name"), (p) => (
              <input {...p} type="text" defaultValue={goal?.name ?? ""} autoComplete="off" maxLength={120} />
            ))}
            {field("targetCents", t("finances.savings.goals.target"), (p) => (
              <input {...p} type="text" inputMode="decimal" autoComplete="off" defaultValue={goal ? centsToInput(goal.targetCents, locale) : ""} />
            ))}
            {/* A month input where the browser has one; elsewhere it is a text field and `MM/YYYY` or `YYYY-MM` is read. */}
            {field(
              "targetMonth",
              t("finances.savings.goals.month"),
              (p) => <input {...p} type="month" placeholder={t("finances.savings.goals.monthFormat")} value={month} onChange={(e) => setMonth(e.target.value)} />,
              t("finances.savings.goals.monthHint"),
            )}
            {month !== "" && (
              <Button type="button" variant="link" className="self-start" onClick={() => setMonth("")}>
                {t("finances.savings.goals.noDate")}
              </Button>
            )}
          </>
        )}
      </SavingsFormDialog>
      {deleting && goal && (
        <DeleteSavingsDialog
          title={t("finances.savings.goals.deleteTitle")}
          body={t("finances.savings.goals.deleteBody", { name: goal.name })}
          action={t("finances.savings.goals.delete")}
          remove={async () => {
            const done = (await remove(goal.id)).kind === "ok";
            if (done) onClose();
            return done;
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}
