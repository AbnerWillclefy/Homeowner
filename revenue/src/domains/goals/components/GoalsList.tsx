import { Banner, Button, Menu, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { SavingsGoal } from "../api";
import type { ReorderOutcome } from "../hooks/useSavings";
import { monthLabel } from "../logic/month";
import { moveId, progressPercent, whenOf } from "../logic/savings";
import { MonthLine } from "./MonthLine";

interface Props {
  goals: SavingsGoal[];
  reorder(ids: string[]): Promise<ReorderOutcome>;
  onEdit(goal: SavingsGoal): void;
  onDelete(goal: SavingsGoal): void;
}

type Direction = "up" | "down";

/**
 * The Goals in the order that decides who is served first. Each one has Move up and Move down buttons, so nothing
 * needs dragging. After a move, focus goes back to the button that was pressed (or to its twin when the Goal
 * reached an end) and a polite line says the new position.
 */
export function GoalsList({ goals, reorder, onEdit, onDelete }: Props) {
  const { t, locale } = useI18n();
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<"failed" | "changed" | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ id: string; direction: Direction } | null>(null);
  // Presses during a pending write are ignored (the buttons stay enabled so focus stays), so writes never overlap.
  const inFlight = useRef(false);

  // Runs when the list arrives in a new order (the move is optimistic, and a rollback is another change): a moved row
  // can drop focus, so it is put back, but never taken from something else the User went to. A button that just became disabled counts as lost.
  useEffect(() => {
    const target = refocus.current;
    const active = document.activeElement as HTMLButtonElement | null;
    if (!target || (active && active !== document.body && !active.disabled)) return;
    const same = buttons.current.get(`${target.id}:${target.direction}`);
    const twin = buttons.current.get(`${target.id}:${target.direction === "up" ? "down" : "up"}`);
    (same && !same.disabled ? same : twin)?.focus();
  }, [goals]);

  async function move(goal: SavingsGoal, direction: Direction) {
    if (inFlight.current) return;
    const ids = moveId(goals.map((g) => g.id), goal.id, direction);
    if (ids.indexOf(goal.id) === goals.findIndex((g) => g.id === goal.id)) return;
    inFlight.current = true;
    setNotice(null);
    setAnnouncement(t("goals.moved", { name: goal.name, position: ids.indexOf(goal.id) + 1, total: ids.length }));
    refocus.current = { id: goal.id, direction };
    try {
      const result = await reorder(ids);
      if (result !== "saved") {
        setNotice(result);
        setAnnouncement("");
      }
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <>
      {notice && <Banner tone="danger">{t(notice === "failed" ? "goals.reorderFailed" : "goals.reorderChanged")}</Banner>}
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <ul aria-label={t("goals.title")} className="divide-y divide-border">
        {goals.map((goal, index) => {
          const money = (cents: number) => formatAmount(cents, { locale });
          const text = t("goals.saved", { saved: money(goal.savedCents), target: money(goal.targetCents) });
          const moveButton = (direction: Direction, Icon: typeof ArrowUp) => (
            <Button
              key={direction}
              ref={(el) => {
                if (el) buttons.current.set(`${goal.id}:${direction}`, el);
                else buttons.current.delete(`${goal.id}:${direction}`);
              }}
              variant="secondary"
              size="sm"
              icon={Icon}
              disabled={direction === "up" ? index === 0 : index === goals.length - 1}
              onClick={() => void move(goal, direction)}
            >
              <span className="sr-only">{t(direction === "up" ? "goals.up" : "goals.down", { name: goal.name })}</span>
            </Button>
          );
          return (
            <li key={goal.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <span className="body-strong [overflow-wrap:anywhere]">{goal.name}</span>
                  {goal.targetMonth && <span className="caption text-text-muted">{t("goals.by", { month: monthLabel(goal.targetMonth, locale) })}</span>}
                </div>
                <Amount cents={goal.targetCents} size="sm" locale={locale} />
              </div>
              {/* The saved amount, the target and the percentage are text beside the bar; the bar only draws them. */}
              <ProgressBar
                tone="brand"
                value={goal.savedCents}
                max={Math.max(goal.targetCents, 1)}
                label={t("goals.progress", { name: goal.name })}
                valueText={text}
                start={text}
                end={t("goals.percent", { percent: progressPercent(goal.savedCents, goal.targetCents) })}
              />
              <MonthLine monthCents={goal.monthCents} when={whenOf(goal)} />
              <div className="flex flex-wrap items-center justify-end gap-1">
                {goals.length > 1 && (
                  <>
                    {moveButton("up", ArrowUp)}
                    {moveButton("down", ArrowDown)}
                  </>
                )}
                <Menu
                  label={t("goals.menu", { name: goal.name })}
                  closeLabel={t("app.close")}
                  items={[
                    { label: t("goals.edit"), icon: Pencil, onSelect: () => onEdit(goal) },
                    { label: t("goals.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(goal) },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
