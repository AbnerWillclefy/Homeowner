import type { DayPlan, PlanTask, SwapOffer } from "../../../src/domains/dayplan/api/api";
import { json, signedIn, type FakeApi, type FakeState } from "../api";

const notFound = () => json(404, { error: "swap_not_found" });

const names = (offer: SwapOffer) => [offer.offered.id, offer.requested.id];

/** Moves a Task out of a list and returns it with the Swap's mark: Committed, and the reason `swapped`. */
function takeOut(tasks: PlanTask[], id: string): PlanTask | undefined {
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) return undefined;
  const [task] = tasks.splice(index, 1);
  return task && { ...task, reason: "swapped", committed: true };
}

/** Mirrors `AcceptSwap`: the Tasks change hands, both read "swapped", and every other offer on either Task goes. */
function accept(plan: DayPlan, offer: SwapOffer): void {
  const received = takeOut(plan.others.find((other) => other.residentId === offer.residentId)?.tasks ?? [], offer.offered.id);
  const given = takeOut(plan.mine, offer.requested.id);
  if (!received || !given) return;
  plan.mine.push(received);
  const group = plan.others.find((other) => other.residentId === offer.residentId);
  if (group) group.tasks.push({ ...given, committed: true });
  else plan.others.push({ residentId: offer.residentId, tasks: [{ ...given, committed: true }] });
  plan.others = plan.others.filter((other) => other.tasks.length > 0);
  const touched = names(offer);
  const untouched = (other: SwapOffer) => !names(other).some((id) => touched.includes(id));
  plan.swaps.incoming = plan.swaps.incoming.filter(untouched);
  plan.swaps.outgoing = plan.swaps.outgoing.filter(untouched);
}

/**
 * The answer routes of Swap offers, stateful against `state.dayPlan`: each mutates the plan in place and answers
 * it, as the real API does. An id that is not on the right list is `404 swap_not_found`. Not part of
 * `signedInHandlers`: a spec opts in with `fakeApi.use(swapsHandlers)`. `POST /home/swaps` (making an offer) is
 * the one route still to add here.
 */
export function swapsHandlers(api: FakeApi): void {
  const answer = (list: "incoming" | "outgoing", change: (plan: DayPlan, offer: SwapOffer) => void) =>
    signedIn((request, state: FakeState) => {
      const plan = state.dayPlan;
      const offer = plan?.swaps[list].find((candidate) => candidate.id === request.params.id);
      if (!plan || !offer) return notFound();
      change(plan, offer);
      return json(200, plan);
    });
  const remove = (list: "incoming" | "outgoing") => (plan: DayPlan, offer: SwapOffer) => {
    plan.swaps[list] = plan.swaps[list].filter((candidate) => candidate.id !== offer.id);
  };

  api.on("POST /home/swaps/{id}/accept", answer("incoming", accept));
  api.on("POST /home/swaps/{id}/decline", answer("incoming", remove("incoming")));
  api.on("POST /home/swaps/{id}/cancel", answer("outgoing", remove("outgoing")));
}
