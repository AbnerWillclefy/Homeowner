import { ArrowLeftRight } from "lucide-react";
import { Button, Choice, ChoiceGroup, List, Row, Sheet } from "@homeowner/bedrock";
import { ChoreIcon } from "@homeowner/bedrock/home";
import { useState, type RefObject } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { choreCategory } from "../../chores/logic/choreCategory";
import { effortName } from "../../chores/logic/effortLevels";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { useI18n } from "../../../shared/i18n";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { PlanTask } from "../api/api";
import { soleHolder, type Requestable } from "../logic/swaps";

/**
 * Offers a Swap for one of your own Tasks, in a Sheet: what you give, and a choice of what to ask for in return.
 * Mounted by the Today plan only while an offer is being made, and only after a tap on "Oferecer troca" in the
 * Task's Sheet (which closes first), so it starts fresh each time and the system never opens it. Every settled
 * answer closes it: a refusal or a failure is then shown by the plan's own status or alert, which the Sheet would
 * otherwise hide behind its scrim. The Resident chooses the Task to ask for; nothing is preselected.
 */
export function SwapSheet({
  offered,
  options,
  offer,
  returnFocusRef,
  onClose,
}: {
  /** Your Task, the one given. */
  offered: PlanTask;
  /** What can be asked for (`requestableTasks`). */
  options: Requestable[];
  /** Resolves when the call has settled, whatever the answer. */
  offer(offeredTaskId: string, requestedTaskId: string): Promise<void>;
  /** The Task card's open button, where focus returns: the Task's Sheet that opened this has already closed. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose(): void;
}) {
  const { t } = useI18n();
  const { residents } = useShell();
  const [selected, setSelected] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  // The guard covers a second tap in the same tick, which the async `sending` state does not.
  const { run: send } = useSubmitOnce(async (requestedTaskId: string) => {
    setSending(true);
    await offer(offered.id, requestedTaskId);
    onClose();
  });

  const nameOf = (residentId: string) => residents.byResidentId(residentId)?.name ?? t("dayplan.others.someone");
  const sole = soleHolder(options);
  const named = sole === null ? undefined : { name: nameOf(sole) };
  const giving = choreCategory(offered.category);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("dayplan.swap.sheet.title")}
      subtitle={named ? t("dayplan.swap.sheet.subtitle.one", named) : t("dayplan.swap.sheet.subtitle")}
      closeLabel={t("dayplan.task.sheet.close")}
      dismissible={!sending}
      returnFocusRef={returnFocusRef}
      footer={
        <Button size="lg" icon={ArrowLeftRight} loading={sending} disabled={selected === undefined} onClick={() => selected !== undefined && void send(selected)}>
          {t("dayplan.swap.sheet.send")}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-4 [overflow-wrap:anywhere]">
        <div className="flex flex-col gap-2">
          <span className="label text-text-muted">{t("dayplan.swap.sheet.give")}</span>
          <List>
            <Row
              leading={<ChoreIcon category={giving} />}
              title={offered.choreName}
              caption={`${labelText(t, categoryLabel(giving.id))} · ${effortName(t, offered.currentEffort)}`}
            />
          </List>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label text-text-muted">{t("dayplan.swap.sheet.inReturn")}</span>
          <ChoiceGroup label={t("dayplan.swap.sheet.group")} value={selected} onValueChange={setSelected}>
            {options.map(({ task, holderId }) => (
              <Choice
                key={task.id}
                value={task.id}
                label={task.choreName}
                leading={<ChoreIcon category={choreCategory(task.category)} />}
                hint={t("dayplan.swap.sheet.hint", {
                  category: labelText(t, categoryLabel(choreCategory(task.category).id)),
                  effort: effortName(t, task.currentEffort),
                  name: nameOf(holderId),
                })}
                disabled={sending}
              />
            ))}
          </ChoiceGroup>
          <span className="caption text-text-muted">{named ? t("dayplan.swap.sheet.caption.one", named) : t("dayplan.swap.sheet.caption")}</span>
        </div>
      </div>
    </Sheet>
  );
}
