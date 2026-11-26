import { useRef, useState } from "react";
import { TaskCard as HomeTaskCard, type TaskAction as HomeAction } from "@homeowner/bedrock/home";
import type { MenuItem } from "@homeowner/bedrock";
import { Check } from "lucide-react";
import { useShell } from "../../../app/components/ShellContext";
import type { Explanation, PlanTask } from "../api/api";
import { choreCategory } from "../../chores/logic/choreCategory";
import { effortName } from "../../chores/logic/effortLevels";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { actionsFor, type CardAction, type TaskAction, type TaskRole } from "../logic/actions";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { dueWhen, formatDay } from "../logic/format";
import { taskReasonText } from "../logic/reasons";
import { taskEffortText } from "../logic/taskEffort";
import { TaskSheet } from "./TaskSheet";

interface Props {
  task: PlanTask;
  /**
   * Where the Task sits: yours, another Resident's or the pool. It decides whether the reason says why it was
   * given to someone or why it is still in the pool, and which actions it has.
   */
  role: TaskRole;
  /** The Resident who holds it, on another Resident's card. */
  holderId?: string;
  /** The plan's day, "YYYY-MM-DD", to say whether the Task is due today. */
  today: string;
  /** The day's explanation, which the Sheet shows on your own Tasks. */
  explanation?: Explanation;
  /** An action is running somewhere in the plan, so every button is disabled. */
  busy: boolean;
  /** This card's own action in flight, which shows the spinner; null when it is another card's or none. */
  pending: TaskAction | null;
  onAction(action: TaskAction, task: PlanTask): void;
  /**
   * Opens the dialog to offer a Swap for this Task, given the card's ⋯ button, where focus returns. Pass it
   * only when a Swap can be offered (`canOfferFor`) on another Resident's card; without it the menu has no Swap.
   * Swap calls nothing, so `onAction` keeps its type.
   */
  onSwap?(task: PlanTask, opener: HTMLElement | null): void;
}

// Each action's visible label and its accessible name, which says which Task and starts with the visible
// label so voice control ("tap Aceitar") finds it.
const ACTION_LABELS: Record<CardAction, { label: MessageKey; named: MessageKey }> = {
  accept: { label: "dayplan.action.accept", named: "dayplan.action.accept.named" },
  refuse: { label: "dayplan.action.refuse", named: "dayplan.action.refuse.named" },
  take: { label: "dayplan.action.take", named: "dayplan.action.take.named" },
  done: { label: "dayplan.action.done", named: "dayplan.action.done.named" },
  swap: { label: "dayplan.action.swap", named: "dayplan.action.swap.named" },
};

/**
 * One Task in the Day Plan, in the Home layer's card: its Category (named in text), the Chore, its Effort and
 * the one-line why, with only the buttons that make sense now (`actionsFor`) and the rest in its ⋯ menu.
 * Tapping the card opens its Sheet with the whole story. This only feeds the presentational card; which
 * actions a Task has is decided in `logic/actions.ts`.
 */
export function TaskCard({ task, role, holderId, today, explanation, busy, pending, onAction, onSwap }: Props) {
  const { t, locale } = useI18n();
  const { residents } = useShell();
  const [open, setOpen] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  const { primary, menu, committed } = actionsFor(task, role, { canSwap: onSwap !== undefined });

  const category = choreCategory(task.category);
  const date = formatDay(task.windowEnd, locale);
  const due = {
    past: t("dayplan.task.duePast", { date }),
    today: t("dayplan.task.dueToday"),
    later: t("dayplan.task.due", { date }),
  }[dueWhen(task.windowEnd, today)];
  const responsible = task.responsibleResidentId ? residents.byResidentId(task.responsibleResidentId) : undefined;
  const reason = taskReasonText(t, task, role, responsible);
  // The Effort component takes a level from 1 to 5; an Effort outside it (the API would refuse it) keeps its number in the name.
  const effortLevel = Math.min(5, Math.max(1, Math.round(task.currentEffort))) as 1 | 2 | 3 | 4 | 5;

  const named = (action: CardAction) => t(ACTION_LABELS[action].named, { task: task.choreName });
  const button = (action: CardAction): HomeAction => ({
    label: t(ACTION_LABELS[action].label),
    ariaLabel: named(action),
    icon: action === "accept" || action === "done" ? Check : undefined,
    // Recusar is the quiet one beside Aceitar.
    variant: action === "refuse" ? "secondary" : "primary",
    disabled: busy,
    loading: pending === action,
    onClick: () => onAction(action as TaskAction, task),
  });
  const menuItem = (action: CardAction): MenuItem => ({
    label: t(ACTION_LABELS[action].label),
    disabled: busy,
    onSelect: () =>
      action === "swap"
        ? onSwap?.(task, item.current?.querySelector<HTMLElement>("[aria-haspopup]") ?? null)
        : onAction(action as TaskAction, task),
  });

  return (
    <li ref={item} className="my-0 list-none">
      <HomeTaskCard
        category={category}
        categoryLabel={labelText(t, categoryLabel(category.id))}
        name={task.choreName}
        effort={{
          level: effortLevel,
          name: effortName(t, task.currentEffort),
          label: taskEffortText(t, task.currentEffort, task.baseEffort),
        }}
        why={reason ?? due}
        status={committed ? t("dayplan.task.committed") : undefined}
        onOpen={() => setOpen(true)}
        menu={
          menu.length > 0
            ? {
                label: t("dayplan.task.menu", { task: task.choreName }),
                closeLabel: t("dayplan.task.sheet.close"),
                items: menu.map(menuItem),
              }
            : undefined
        }
        actions={primary.map(button)}
      />
      {/* Mounted only while open: it reads the Chores for the Demands, which no closed card should. */}
      {open && (
        <TaskSheet
          onClose={() => setOpen(false)}
          task={task}
          role={role}
          holderId={holderId}
          due={due}
          reason={reason}
          explanation={explanation}
        />
      )}
    </li>
  );
}
