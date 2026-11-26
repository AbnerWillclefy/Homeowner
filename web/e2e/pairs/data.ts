import type { Chore } from "../../src/domains/chores/api/api";
import type { DayPlan, PlanTask } from "../../src/domains/dayplan/api/api";
import type { FakeState } from "../mocks/api";
import { uncheckedDay } from "../mocks/handlers/today";
import { signedInResident } from "../mocks/sampleHome";
import type { Data } from "./screens";

// The sample household of the artboards (Main wins where two disagree): Chore and Resident names, the Energy and
// the Streak. It starts from signedInResident() and does not edit sampleHome.ts, whose values the e2e specs assert on.

// [id, name, category, effort, interval in days]
const CHORES: [string, string, string, number, number][] = [
  ["louca", "Lavar a louça", "kitchen", 2, 1],
  ["lixo", "Tirar o lixo", "trash", 1, 3],
  ["roupa", "Dobrar a roupa", "laundry", 2, 3],
  ["pia", "Limpar a pia do banheiro", "bathroom", 2, 7],
  ["plantas", "Regar as plantas", "outdoor", 2, 2],
  ["areia", "Limpar a caixa de areia", "pets", 2, 1],
  ["cama", "Trocar a roupa de cama", "bedroom", 3, 7],
];

const chore = ([id, name, category, effort, intervalDays]: (typeof CHORES)[number]): Chore => ({
  id, name, category, demands: [], baseEffort: effort, importance: "normal", people: 1, intervalDays, allowedWeekdays: [], buildsUp: false, responsibleResidentId: null,
});

const task = (id: string, due: string, committed = false): PlanTask => {
  const [, name, category, effort] = CHORES.find(([c]) => c === id)!;
  return { id: `task-${id}`, choreId: id, choreName: name, windowStart: "2030-01-14", windowEnd: due, currentEffort: effort, baseEffort: effort, importance: "normal", people: 1, reason: "due", category, committed };
};

function plan(done: boolean): DayPlan {
  return {
    date: "2030-01-15",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "template",
    energy: 4,
    mine: done ? [] : [task("louca", "2030-01-16"), task("lixo", "2030-01-16"), task("roupa", "2030-01-16", true)],
    others: [{ residentId: "resident-2", tasks: [task("cama", "2030-01-16", true)] }],
    pool: done ? [] : [task("plantas", "2030-01-15"), task("areia", "2030-01-16")],
    doneToday: [
      { id: "task-pia", choreName: "Limpar a pia do banheiro", completedAt: "2030-01-15T12:02:00Z", category: "bathroom", with: [] },
      ...(done ? ["louca", "lixo", "roupa"].map((id, i) => ({ id: `task-${id}`, choreName: CHORES.find(([c]) => c === id)![1], completedAt: `2030-01-15T12:1${i}:00Z`, category: CHORES.find(([c]) => c === id)![2], with: [] })) : []),
    ],
    swaps: { incoming: [], outgoing: [] },
  };
}

/** The FakeState a screen is shot with: the household above, shaped by what its `data` asks for. */
export function pairsHome(data: Data = "default"): FakeState {
  const state = signedInResident();
  state.user = { ...state.user, displayName: "Você" };
  state.residents = [
    { id: "resident-1", you: true, name: "Você", photoUrl: null },
    { id: "resident-2", you: false, name: "Ana", photoUrl: null },
  ];
  state.chores = data === "no-chores" ? [] : CHORES.map(chore);
  state.dayPlan = plan(data === "done");
  state.streak = 6;
  state.streakTodayGrew = true;
  if (data === "unchecked") state.checkIn = uncheckedDay();
  if (data === "onboarding") {
    state.home = null;
    state.onboardingStored = null;
  }
  return state;
}
