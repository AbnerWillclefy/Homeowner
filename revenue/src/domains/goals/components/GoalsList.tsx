import { Badge, Banner, Card, Menu, ProgressBar } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { ArrowDown, ArrowUp, Pencil, Target, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { SavingsGoal } from "../api";
import { useMoney } from "../hooks/useMoney";
import type { ReorderOutcome } from "../hooks/useSavings";
import { monthLabel } from "../logic/month";
import { goalTone, moveId, progressPercent, whenOf } from "../logic/savings";
import { GoalFacts } from "./GoalFacts";

interface Props {
  goals: SavingsGoal[];
  /** Names of the Investments that serve the Goals, shown under each card. */
  where: string[];
  reorder(ids: string[]): Promise<ReorderOutcome>;
  onEdit(goal: SavingsGoal): void;
  onDelete(goal: SavingsGoal): void;
}

type Direction = "up" | "down";

/**
 * One card per Goal, in the order that decides who is served first (the grid's order). Each card's "More actions"
 * menu has Move up and Move down, so nothing needs dragging. After a move, focus goes back to that card's menu button
 * and a polite line says the new position.
 */
export function GoalsList({ goals, where, reorder, onEdit, onDelete }: Props) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const hide = useHiddenProps();
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<"failed" | "changed" | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const refocus = useRef<string | null>(null);
  // A move during a pending write is ignored, so writes never overlap.
  const inFlight = useRef(false);

  // Runs when the list arrives in a new order (the move is optimistic, and a rollback is another change): a moved card
  // can drop focus, so it goes back to its menu button, but never taken from something else the User went to.
  useEffect(() => {
    const id = refocus.current;
    const active = document.activeElement;
    if (!id || (active && active !== document.body)) return;
    cards.current.get(id)?.querySelector("button")?.focus();
  }, [goals]);

  async function move(goal: SavingsGoal, direction: Direction) {
    if (inFlight.current) return;
    const ids = moveId(goals.map((g) => g.id), goal.id, direction);
    if (ids.indexOf(goal.id) === goals.findIndex((g) => g.id === goal.id)) return;
    inFlight.current = true;
    setNotice(null);
    setAnnouncement(t("goals.moved", { name: goal.name, position: ids.indexOf(goal.id) + 1, total: ids.length }));
    refocus.current = goal.id;
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
      {notice && <Banner tone="danger" className="desktop:col-span-12">{t(notice === "failed" ? "goals.reorderFailed" : "goals.reorderChanged")}</Banner>}
      <p aria-live="polite" className="sr-only">{announcement}</p>
      {goals.map((goal, index) => {
        const tone = goalTone(index);
        const when = whenOf(goal);
        const percent = progressPercent(goal.savedCents, goal.targetCents);
        const badge =
          goal.targetMonth && when.kind !== "reached" ? (
            <Badge tone={goal.late ? "warning" : "positive"}>{t(goal.late ? "goals.card.afterDate" : "goals.card.onTime")}</Badge>
          ) : null;
        return (
          <Card
            key={goal.id}
            ref={(el) => {
              if (el) cards.current.set(goal.id, el);
              else cards.current.delete(goal.id);
            }}
            className="desktop:col-span-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="body-strong flex min-w-0 items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: tone.soft, color: tone.color }}>
                  <Target className="size-4" aria-hidden />
                </span>
                <span className="[overflow-wrap:anywhere]">{goal.name}</span>
              </h2>
              <Menu
                label={t("goals.menu", { name: goal.name })}
                closeLabel={t("app.close")}
                items={[
                  { label: t("goals.edit"), icon: Pencil, onSelect: () => onEdit(goal) },
                  { label: t("goals.up", { name: goal.name }), icon: ArrowUp, disabled: index === 0, onSelect: () => void move(goal, "up") },
                  { label: t("goals.down", { name: goal.name }), icon: ArrowDown, disabled: index === goals.length - 1, onSelect: () => void move(goal, "down") },
                  { label: t("goals.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(goal) },
                ]}
              />
            </div>
            <Amount cents={goal.savedCents} size="md" reference={goal.targetCents} locale={locale} {...hide} />
            {/* The amounts are text above and the percentage beside the bar; the bar only draws them. */}
            <ProgressBar
              tone="brand"
              value={goal.savedCents}
              max={Math.max(goal.targetCents, 1)}
              label={t("goals.progress", { name: goal.name })}
              valueText={t("goals.saved", { saved: money(goal.savedCents), target: money(goal.targetCents) })}
              start={<strong>{t("goals.percent", { percent })}</strong>}
              end={goal.targetMonth ? t("goals.by", { month: monthLabel(goal.targetMonth, locale) }) : t("goals.form.noDate")}
            />
            <GoalFacts monthCents={goal.monthCents} when={when} badge={badge} where={where} />
          </Card>
        );
      })}
    </>
  );
}
