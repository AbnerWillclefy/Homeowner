import { ArrowLeftRight, Check, Pencil, Sparkles } from "lucide-react";
import { Button, Card, CardLabel, DescriptionList, Menu, Sheet, type DescriptionListItem, type MenuItem } from "@homeowner/bedrock";
import { ChoreIcon, Effort, type EffortProps } from "@homeowner/bedrock/home";
import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import { CHORES_PATH } from "../../../app/logic/routes";
import { choresQuery } from "../../chores/api/queries";
import { EDIT_PARAM } from "../../chores/components/ChoresSection";
import { choreCategory } from "../../chores/logic/choreCategory";
import { categoryLabel, demandLabel, importanceLabel, labelText } from "../../profile/logic/labels";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import type { Explanation, PlanTask } from "../api/api";
import type { TaskAction, TaskActions, TaskRole } from "../logic/actions";
import { EXPLANATION_SOURCES } from "../logic/explanationSource";
import { lastDoneText } from "../logic/lastDone";

// What the Task's state says in the subtitle: yours Proposed or Committed, another Resident's, or still in the pool.
const STATE_KEYS = {
  mine: "dayplan.task.sheet.state.proposed",
  committed: "dayplan.task.sheet.state.committed",
  other: "dayplan.task.sheet.state.other",
  pool: "dayplan.task.sheet.state.pool",
} as const satisfies Record<string, MessageKey>;

const ACTION_LABEL = {
  accept: "dayplan.action.accept",
  refuse: "dayplan.action.refuse",
  take: "dayplan.action.take",
  done: "dayplan.action.done",
} as const satisfies Record<TaskAction, MessageKey>;

/**
 * The whole story of one Task, in a Sheet: why it is here (the full reason, and for your own Tasks the day's
 * explanation), its facts (Effort, when it is due, Importance, when it was last done, Demands, people), the ⋯ menu
 * (Swap on your own Task, edit the Chore, Done on a pool Task) and the Task's actions at the foot, the same the card
 * has (`onAction`). Mounted only while open, so the Chores are read only when someone looks. An action closes it,
 * and the plan's own notice and Undo toast say the rest. Closing returns focus to the card's open button.
 */
export function TaskSheet({
  onClose,
  task,
  role,
  today,
  due,
  reason,
  explanation,
  effort,
  actions,
  busy,
  onAction,
  returnFocusRef,
  onSwap,
}: {
  onClose(): void;
  /** The card's open button, where focus returns on close. */
  returnFocusRef: RefObject<HTMLElement | null>;
  task: PlanTask;
  role: TaskRole;
  /** The plan's day, "YYYY-MM-DD", for "Hoje" and "Ontem" in the last-done row. */
  today: string;
  /** "Para hoje" and the like, worded by the card. */
  due: string;
  /** The one-line why in full; null before the day is planned. */
  reason: string | null;
  explanation?: Explanation;
  effort: EffortProps;
  /** What `actionsFor` gives this Task: the footer buttons and the menu's one-step actions. */
  actions: TaskActions;
  /** An action is running somewhere in the plan. */
  busy: boolean;
  onAction(action: TaskAction): void;
  /** Only on a Task that can be offered (`canOfferFor`); the card closes this Sheet and opens the Swap one. */
  onSwap?(): void;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { residents } = useShell();
  const category = choreCategory(task.category);
  // The Demands live on the Chore, not on the Task. Until the Chores are read the row is left out rather than guessed.
  const chore = useQuery(choresQuery).data?.find((c) => c.id === task.choreId);
  const source = explanation && role === "mine" ? EXPLANATION_SOURCES[explanation.source] : null;

  const run = (action: TaskAction) => {
    onAction(action);
    onClose();
  };
  const items: MenuItem[] = [
    ...(onSwap ? [{ label: t("dayplan.swap.sheet.title"), icon: ArrowLeftRight, onSelect: onSwap }] : []),
    { label: t("dayplan.task.sheet.edit"), icon: Pencil, onSelect: () => navigate(`${CHORES_PATH}?${EDIT_PARAM}=${encodeURIComponent(task.choreId)}`) },
    ...actions.menu.map((action) => ({ label: t(ACTION_LABEL[action]), icon: Check, disabled: busy, onSelect: () => run(action) })),
  ];

  const rows: DescriptionListItem[] = [
    { label: t("dayplan.task.sheet.row.effort"), value: <Effort {...effort} className="text-text" /> },
    { label: t("dayplan.task.sheet.row.due"), value: due },
    { label: t("dayplan.task.sheet.row.importance"), value: labelText(t, importanceLabel(task.importance)) },
    ...(task.lastDone
      ? [{
          label: t("dayplan.task.sheet.row.last"),
          value: lastDoneText(t, locale, today, task.lastDone.date, task.lastDone.residentIds.flatMap((id) => residents.byResidentId(id)?.name ?? [])),
        }]
      : []),
    ...(chore
      ? [{
          label: t("dayplan.task.sheet.row.demands"),
          value: <span className="inline-block max-w-56 whitespace-normal [overflow-wrap:anywhere]">{chore.demands.length > 0 ? chore.demands.map((id) => labelText(t, demandLabel(id))).join(", ") : t("dayplan.task.sheet.demands.none")}</span>,
        }]
      : []),
    ...(task.people === 2 || task.with ? [{ label: t("dayplan.task.sheet.row.people"), value: t("chores.item.people.two") }] : []),
  ];

  const named = (action: TaskAction) => (
    <Button
      key={action}
      size="lg"
      variant={action === "refuse" ? "secondary" : "primary"}
      icon={action === "accept" || action === "done" ? Check : undefined}
      disabled={busy}
      className="flex-1"
      onClick={() => run(action)}
    >
      {t(ACTION_LABEL[action])}
    </Button>
  );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={task.choreName}
      subtitle={`${labelText(t, categoryLabel(category.id))} · ${t(STATE_KEYS[role === "mine" && task.committed ? "committed" : role])}`}
      closeLabel={t("dayplan.task.sheet.close")}
      returnFocusRef={returnFocusRef}
      leading={<ChoreIcon category={category} size="lg" />}
      tools={<Menu label={t("dayplan.task.menu", { task: task.choreName })} closeLabel={t("dayplan.task.sheet.close")} items={items} />}
      footer={actions.primary.length > 0 ? <div className="flex gap-2">{actions.primary.map(named)}</div> : undefined}
    >
      <div className="flex flex-col gap-4 pb-4 [overflow-wrap:anywhere]">
        <Card variant="compact" className="gap-2">
          <CardLabel className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            {t("dayplan.task.sheet.why")}
          </CardLabel>
          {reason && <p className="body my-0">{reason}</p>}
          {explanation && source && (
            <>
              <p className="body my-0 text-text-muted">{explanation.detail[locale]}</p>
              <span className="caption text-text-muted">{t(source.labelKey)}</span>
            </>
          )}
        </Card>

        <DescriptionList items={rows} />

        {task.suggestTwoPerson && task.people !== 2 && role !== "other" && (
          <p className="my-0 flex flex-wrap items-center gap-x-2 text-sm">
            <span>{t("dayplan.task.suggestTwoPerson")}</span>
            <Link
              to={`${CHORES_PATH}?${EDIT_PARAM}=${encodeURIComponent(task.choreId)}`}
              aria-label={t("dayplan.task.suggestTwoPerson.action.named", { task: task.choreName })}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[0.2em]"
            >
              {t("dayplan.task.suggestTwoPerson.action")}
            </Link>
          </p>
        )}
      </div>
    </Sheet>
  );
}
