import type { DayPlan, PlanTask } from "../../../src/domains/dayplan/api/api";
import { json, signedIn, type FakeApi, type FakeState } from "../api";
import type { FakeReply } from "../router";

const notFound = () => json(404, { error: "task not found" });

/** Moves a Task out of a list and returns it, or undefined when the list does not hold it. */
function takeOut(tasks: PlanTask[], id: string): PlanTask | undefined {
  const index = tasks.findIndex((task) => task.id === id);
  return index < 0 ? undefined : tasks.splice(index, 1)[0];
}

/** Today's fixed clock for a Completion, so nothing depends on the real one. */
const COMPLETED_AT = "2030-01-15T14:30:00-03:00";

/**
 * The Task action routes, stateful against `state.dayPlan`: each mutates the plan in place and answers it, as the
 * real API does (`handler_actions.go`). A Task that is not on the right list is `404 task not found`.
 * - `accept`: one of your Proposed Tasks becomes Committed. `POST /home/day-plan/accept-all` does it for every one.
 * - `refuse`: one of yours goes back to the pool.
 * - `take`: a pool Task becomes yours and Committed.
 * - `complete`: one of yours, or one in the pool, leaves its list and joins `doneToday`.
 * Not part of `signedInHandlers`: a spec opts in with `fakeApi.use(tasksHandlers)`.
 */
export function tasksHandlers(api: FakeApi): void {
  const action = (change: (plan: DayPlan, id: string) => FakeReply | void) =>
    signedIn((request, state: FakeState) => {
      const plan = state.dayPlan;
      if (!plan) return json(409, { error: "no_plan_today" });
      return change(plan, request.params.id as string) ?? json(200, plan);
    });

  api.on(
    "POST /home/tasks/{id}/accept",
    action((plan, id) => {
      const task = plan.mine.find((candidate) => candidate.id === id);
      if (!task) return notFound();
      task.committed = true;
    }),
  );

  api.on(
    "POST /home/tasks/{id}/refuse",
    action((plan, id) => {
      const task = takeOut(plan.mine, id);
      if (!task) return notFound();
      const { committed: _committed, ...open } = task;
      plan.pool.push({ ...open, reason: "refused" });
    }),
  );

  api.on(
    "POST /home/tasks/{id}/take",
    action((plan, id) => {
      const task = takeOut(plan.pool, id);
      if (!task) return notFound();
      plan.mine.push({ ...task, reason: "taken", committed: true });
    }),
  );

  api.on(
    "POST /home/tasks/{id}/complete",
    action((plan, id) => {
      const task = takeOut(plan.mine, id) ?? takeOut(plan.pool, id);
      if (!task) return notFound();
      plan.doneToday.push({
        id: task.id,
        choreName: task.choreName,
        completedAt: COMPLETED_AT,
        with: [],
        ...(task.category === undefined ? {} : { category: task.category }),
      });
    }),
  );

  api.on(
    "POST /home/day-plan/accept-all",
    signedIn((_, state: FakeState) => {
      const plan = state.dayPlan;
      if (!plan) return json(409, { error: "no_plan_today" });
      for (const task of plan.mine) task.committed = true;
      return json(200, plan);
    }),
  );
}
