import type { DayPlan, PlanTask, SwapOffer } from "../../../src/domains/dayplan/api/api";
import { json, signedIn, type FakeApi, type FakeState } from "../api";
import type { FakeReply } from "../router";

const notFound = () => json(404, { error: "swap_not_found" });

const taskIds = (offer: SwapOffer) => [offer.offered.id, offer.requested.id];

/** Moves a Task out of a list and returns it with the Swap's mark: Committed, and the reason `swapped`. */
function takeOut(tasks: PlanTask[], id: string): PlanTask | undefined {
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) return undefined;
  const [task] = tasks.splice(index, 1);
  return task && { ...task, reason: "swapped", committed: true };
}

/** Mirrors `AcceptSwap`: the Tasks change hands, both read "swapped", and every other offer on either Task goes. */
function accept(plan: DayPlan, offer: SwapOffer): FakeReply | undefined {
  const group = plan.others.find((other) => other.residentId === offer.residentId);
  const received = takeOut(group?.tasks ?? [], offer.offered.id);
  const given = takeOut(plan.mine, offer.requested.id);
  if (!received || !given) return notFound();
  plan.mine.push(received);
  if (group) group.tasks.push({ ...given, committed: true });
  else plan.others.push({ residentId: offer.residentId, tasks: [{ ...given, committed: true }] });
  plan.others = plan.others.filter((other) => other.tasks.length > 0);
  const touched = taskIds(offer);
  const untouched = (other: SwapOffer) => !taskIds(other).some((id) => touched.includes(id));
  plan.swaps.incoming = plan.swaps.incoming.filter(untouched);
  plan.swaps.outgoing = plan.swaps.outgoing.filter(untouched);
  return undefined;
}

/**
 * The answer routes of Swap offers, stateful against `state.dayPlan`: each mutates the plan in place and answers
 * it, as the real API does. An id that is not on the right list is `404 swap_not_found`. Not part of
 * `signedInHandlers`: a spec opts in with `fakeApi.use(swapsHandlers)`. `POST /home/swaps` makes an offer: the
 * offered Task must be one of yours (else `409 not_yours`) and the requested one another Resident's (else
 * `409 not_held_by_other`); the new offer is appended to `swaps.outgoing` and the plan answered. Restrictions,
 * Drained and a pending offer are the real server's call: a spec forces those with `fakeApi.override`.
 */
export function swapsHandlers(api: FakeApi): void {
  api.on(
    "POST /home/swaps",
    signedIn((request, state: FakeState) => {
      const plan = state.dayPlan;
      if (!plan) return json(409, { error: "no_plan_today" });
      const { offeredTaskId, requestedTaskId } = (request.body ?? {}) as { offeredTaskId?: string; requestedTaskId?: string };
      const offered = plan.mine.find((task) => task.id === offeredTaskId);
      if (!offered) return json(409, { error: "not_yours" });
      const holder = plan.others.find((other) => other.tasks.some((task) => task.id === requestedTaskId));
      const requested = holder?.tasks.find((task) => task.id === requestedTaskId);
      if (!holder || !requested) return json(409, { error: "not_held_by_other" });
      // As `tasks.Open` does: what the offer shows is the Task, without its reason, Commitment or partners.
      const open = ({ reason: _reason, committed: _committed, with: _with, ...task }: PlanTask): PlanTask => task as PlanTask;
      plan.swaps.outgoing.push({
        id: `swap-${plan.swaps.outgoing.length + plan.swaps.incoming.length + 1}`,
        residentId: holder.residentId,
        offered: open(offered),
        requested: open(requested),
      });
      return json(200, plan);
    }),
  );

  const answer = (list: "incoming" | "outgoing", change: (plan: DayPlan, offer: SwapOffer) => FakeReply | void) =>
    signedIn((request, state: FakeState) => {
      const plan = state.dayPlan;
      const offer = plan?.swaps[list].find((candidate) => candidate.id === request.params.id);
      if (!plan || !offer) return notFound();
      return change(plan, offer) ?? json(200, plan);
    });
  const remove = (list: "incoming" | "outgoing") => (plan: DayPlan, offer: SwapOffer) => {
    plan.swaps[list] = plan.swaps[list].filter((candidate) => candidate.id !== offer.id);
  };

  api.on("POST /home/swaps/{id}/accept", answer("incoming", accept));
  api.on("POST /home/swaps/{id}/decline", answer("incoming", remove("incoming")));
  api.on("POST /home/swaps/{id}/cancel", answer("outgoing", remove("outgoing")));
}
