import { useId, useState, type FormEvent } from "react";
import type { PlanTask } from "../api/api";
import { categoryStyle } from "../../chores/logic/categoryStyle";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { ResidentLabel } from "../../residents/components/ResidentLabel";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { preselectedOffer } from "../logic/swaps";

// A Task drawn as a full-width row around a hidden radio, filled when picked (as the Check-in levels are).
const OPTION =
  "relative mt-0 flex min-h-14 cursor-pointer items-center gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 font-semibold motion-safe:transition-colors motion-safe:duration-150 has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed";

/**
 * Asks what the Resident will give for another Resident's Task. Mounted by the Today plan only while an offer is
 * being made, and only after a tap, so it starts fresh each time and the system never opens it. The only
 * Task they can give is preselected. Every settled answer closes it: a refusal or a failure is then shown by
 * the plan's own status or alert, which the dialog would otherwise hide behind its inert backdrop.
 */
export function OfferSwapDialog({
  requested,
  holderId,
  options,
  offer,
  onClose,
}: {
  /** The Task wanted. */
  requested: PlanTask;
  /** The Resident who holds it. */
  holderId: string;
  /** The Tasks of the caller that can be given (`offerableTasks`). */
  options: PlanTask[];
  /** Resolves when the call has settled, whatever the answer. */
  offer(offeredTaskId: string, requestedTaskId: string): Promise<void>;
  onClose(): void;
}) {
  const { t } = useI18n();
  const formId = useId();
  const groupName = useId();
  const [selected, setSelected] = useState<string | null>(() => preselectedOffer(options));
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);

  // The guard covers a second Enter in the same tick, which the async `sending` state does not.
  const { run: send } = useSubmitOnce(async (offeredTaskId: string) => {
    setSending(true);
    await offer(offeredTaskId, requested.id);
    onClose();
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (selected === null) return setMissing(true);
    void send(selected);
  }

  return (
    <AppDialog
      title={t("dayplan.swap.offer.title")}
      onDismiss={onClose}
      dismissible={!sending}
      footer={
        <ButtonRow
          start={
            <Button variant="secondary" disabled={sending} onClick={onClose}>
              {t("dayplan.swap.offer.cancel")}
            </Button>
          }
          end={
            <Button type="submit" form={formId} pending={sending}>
              {t("dayplan.swap.offer.submit")}
            </Button>
          }
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="mt-3 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="my-0 [overflow-wrap:anywhere]">{t("dayplan.swap.offer.body", { task: requested.choreName })}</p>
          <p className="my-0 font-semibold">
            <ResidentLabel residentId={holderId} />
          </p>
          <p className="my-0 text-sm text-muted">{t("dayplan.swap.offer.hint")}</p>
        </div>

        <fieldset
          className="m-0 min-w-0 border-0 p-0"
          disabled={sending}
          aria-describedby={missing ? `${groupName}-error` : undefined}
        >
          <legend className="p-0 text-lg font-semibold">{t("dayplan.swap.offer.legend")}</legend>
          <div className="mt-3 flex flex-col gap-2">
            {options.map((task) => (
              <label key={task.id} className={OPTION}>
                <input
                  type="radio"
                  name={groupName}
                  className="sr-only"
                  checked={selected === task.id}
                  onChange={() => {
                    setMissing(false);
                    setSelected(task.id);
                  }}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="block">{task.choreName}</span>
                  <span className="block text-sm font-normal">
                    {labelText(t, categoryLabel(categoryStyle(task.category).id))}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {missing && (
            <p id={`${groupName}-error`} role="alert" className="mt-2 mb-0 text-danger">
              {t("dayplan.swap.offer.required")}
            </p>
          )}
        </fieldset>
      </form>
    </AppDialog>
  );
}
