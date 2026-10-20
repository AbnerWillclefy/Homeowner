import type { PlanTask, SwapOffer } from "../api/api";
import { categoryStyle } from "../../chores/logic/categoryStyle";
import { CategoryTile } from "../../chores/components/FactList";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { ResidentLabel } from "../../residents/components/ResidentLabel";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Card } from "../../../shared/ui/Card";
import { GroupHeading } from "../../../shared/ui/GroupHeading";
import { pendingSwap, type Acting, type SwapAction } from "../logic/actions";

const LIST = "m-0 flex list-none flex-col gap-3 p-0";

type Direction = "incoming" | "outgoing";

interface Props {
  offers: SwapOffer[];
  direction: Direction;
  acting: Acting;
  onAnswer(action: SwapAction, swapId: string): void;
}

/** Each answer's visible label and its accessible name, which starts with the label and names both Chores. */
const LABELS: Record<SwapAction, { label: MessageKey; named: MessageKey }> = {
  acceptSwap: { label: "dayplan.action.accept", named: "dayplan.swap.accept.named" },
  declineSwap: { label: "dayplan.swap.decline", named: "dayplan.swap.decline.named" },
  cancelSwap: { label: "dayplan.swap.cancel", named: "dayplan.swap.cancel.named" },
};

/**
 * What differs between the two groups. `offered` is what the offerer gives and `requested` what they ask for, so
 * an incoming card reads "Gives / Wants" and an outgoing one, said from the caller's side, "You give / You get".
 */
const DIRECTIONS: Record<
  Direction,
  { heading: MessageKey; offered: MessageKey; requested: MessageKey; hint: boolean; start: SwapAction; end?: SwapAction }
> = {
  incoming: {
    heading: "dayplan.swap.incoming.heading",
    offered: "dayplan.swap.gives",
    requested: "dayplan.swap.wants",
    hint: false,
    start: "declineSwap",
    end: "acceptSwap",
  },
  outgoing: {
    heading: "dayplan.swap.outgoing.heading",
    offered: "dayplan.swap.youGive",
    requested: "dayplan.swap.youGet",
    hint: true,
    start: "cancelSwap",
  },
};

/**
 * "Offers to you" waits on the Resident, so it sits above their own Tasks; "Your offers" waits on someone else,
 * so it sits below. Empty renders nothing.
 */
export function OfferGroup({ offers, direction, acting, onAnswer }: Props) {
  const { t } = useI18n();
  if (offers.length === 0) return null;
  return (
    <div>
      <GroupHeading count={offers.length}>{t(DIRECTIONS[direction].heading)}</GroupHeading>
      <ul className={LIST}>
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} direction={direction} acting={acting} onAnswer={onAnswer} />
        ))}
      </ul>
    </div>
  );
}

/** One side of a Swap: a label, the Chore's Category tile and name, and the Chore. Wraps, never truncates. */
function Side({ label, task }: { label: string; task: PlanTask }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1">
      <p className="my-0 text-xs font-bold text-muted">{label}</p>
      <div className="flex items-center gap-3">
        <CategoryTile category={task.category} />
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="my-0 text-sm font-semibold">{labelText(t, categoryLabel(categoryStyle(task.category).id))}</p>
          <p className="my-0 font-bold leading-snug">{task.choreName}</p>
        </div>
      </div>
    </div>
  );
}

/** One Swap offer. Declining and cancelling are plain answers, not failures: the card just leaves, with nothing in danger colours. */
function OfferCard({ offer, direction, acting, onAnswer }: Omit<Props, "offers"> & { offer: SwapOffer }) {
  const { t } = useI18n();
  const { offered, requested, hint, start, end } = DIRECTIONS[direction];
  const busy = acting !== null;
  const pending = pendingSwap(acting, offer.id);
  const answer = (action: SwapAction, variant: "primary" | "secondary") => (
    <Button
      key={action}
      variant={variant}
      disabled={busy}
      pending={pending === action}
      aria-label={t(LABELS[action].named, { give: offer.offered.choreName, want: offer.requested.choreName })}
      onClick={() => onAnswer(action, offer.id)}
    >
      {t(LABELS[action].label)}
    </Button>
  );

  return (
    <li className="my-0 list-none">
      <Card className="flex flex-col gap-3">
        <p className="my-0 font-bold">
          <ResidentLabel residentId={offer.residentId} />
        </p>
        <Side label={t(offered)} task={offer.offered} />
        <Side label={t(requested)} task={offer.requested} />
        {hint && (
          <p className="my-0 text-sm font-semibold text-muted [overflow-wrap:anywhere]">
            {t("dayplan.swap.hint", { task: offer.requested.choreName })}
          </p>
        )}
        <ButtonRow start={answer(start, "secondary")} end={end && answer(end, "primary")} />
      </Card>
    </li>
  );
}
