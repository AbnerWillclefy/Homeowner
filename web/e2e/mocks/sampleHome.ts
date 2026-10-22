import type { Chore } from "../../src/domains/chores/api/api";
import type { DayPlan, PlanTask } from "../../src/domains/dayplan/api/api";
import type { FakeState } from "./api";
import { initialState } from "./api";
import { FAKE_TODAY } from "./handlers/today";

export const RESIDENT_EMAIL = "resident@example.test";
export const SECOND_RESIDENT_EMAIL = "beto@example.test";

const CHORES: Chore[] = [
  { id: "chore-1", name: "Wash the dishes", category: "kitchen", demands: [], baseEffort: 2, importance: "normal", people: 1, intervalDays: 1, allowedWeekdays: [], buildsUp: false },
  { id: "chore-2", name: "Mop the floors", category: "floors", demands: ["bending"], baseEffort: 3, importance: "normal", people: 1, intervalDays: 7, allowedWeekdays: [], buildsUp: true },
  { id: "chore-3", name: "Take out the trash", category: "trash", demands: [], baseEffort: 1, importance: "essential", people: 1, intervalDays: 3, allowedWeekdays: [], buildsUp: false },
];

const task = (id: string, chore: Chore, reason: string): PlanTask => ({
  id,
  choreId: chore.id,
  choreName: chore.name,
  windowStart: "2030-01-14",
  windowEnd: "2030-01-16",
  currentEffort: chore.baseEffort,
  baseEffort: chore.baseEffort,
  importance: chore.importance,
  people: chore.people,
  reason,
  category: chore.category,
});

/** A planned day: two Tasks for the Resident, one for another Resident and one nobody could take. */
function plannedDay(): DayPlan {
  const [dishes, mop, trash] = CHORES as [Chore, Chore, Chore];
  return {
    date: FAKE_TODAY,
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "template",
    energy: 8,
    mine: [task("task-1", dishes, "due"), task("task-2", mop, "due")],
    others: [{ residentId: "resident-2", tasks: [task("task-3", trash, "due")] }],
    pool: [task("task-4", trash, "no_energy_left")],
    doneToday: [],
    swaps: { incoming: [], outgoing: [] },
  };
}

/** A Resident who finished onboarding: a Home with three Chores, a full Profile and a planned day. */
export function signedInResident(): FakeState {
  return {
    ...initialState(),
    user: { id: "user-1", email: RESIDENT_EMAIL },
    onboardingStored: "done",
    home: { id: "home-1", timezone: "America/Sao_Paulo", allocationTime: "07:00" },
    profile: {
      baseline: { sunday: 4, monday: 8, tuesday: 8, wednesday: 14, thursday: 4, friday: 8, saturday: 14 },
      preferences: { kitchen: "like" },
      restrictions: ["bending"],
    },
    chores: structuredClone(CHORES),
    residents: [
      { id: "resident-1", you: true, name: "resident", photoUrl: null },
      { id: "resident-2", you: false, name: "Bruna Souza", photoUrl: null },
    ],
    checkIn: { date: FAKE_TODAY, checkedIn: false, level: null, restrictions: [] },
    dayPlan: plannedDay(),
  };
}

/** A different Resident in another Home: Beto Bezerra, whose one Task is "Water the plants". */
export function secondResident(): FakeState {
  const state = signedInResident();
  const plants: Chore = { ...CHORES[0]!, id: "chore-4", name: "Water the plants", category: "outdoor" };
  state.user = { id: "user-2", email: SECOND_RESIDENT_EMAIL, displayName: "Beto Bezerra" };
  state.home = { id: "home-2", timezone: "America/Manaus", allocationTime: "06:30" };
  state.chores = [plants];
  state.residents = [{ id: "resident-3", you: true, name: "Beto Bezerra", photoUrl: null }];
  state.dayPlan = { ...plannedDay(), allocationTime: "06:30", mine: [task("task-5", plants, "due")], others: [], pool: [] };
  return state;
}

/** Bruna Souza (`resident-2`) offers her `task-3` for your `task-1`. Edits the state and returns it. */
export function withIncomingOffer(state: FakeState): FakeState {
  const plan = state.dayPlan!;
  plan.swaps.incoming.push({
    id: "swap-in-1",
    residentId: "resident-2",
    offered: plan.others[0]!.tasks[0]!,
    requested: plan.mine[0]!,
  });
  return state;
}

/** You offer your `task-2` to Bruna Souza (`resident-2`) for her `task-3`. Edits the state and returns it. */
export function withOutgoingOffer(state: FakeState): FakeState {
  const plan = state.dayPlan!;
  plan.swaps.outgoing.push({
    id: "swap-out-1",
    residentId: "resident-2",
    offered: plan.mine[1]!,
    requested: plan.others[0]!.tasks[0]!,
  });
  return state;
}
