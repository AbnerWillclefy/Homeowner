import type { Chore } from "../../src/domains/chores/api/api";
import type { DayPlan, PlanTask } from "../../src/domains/dayplan/api/api";
import type { FakeState } from "../mocks/api";
import { uncheckedDay } from "../mocks/handlers/today";
import { signedInResident } from "../mocks/sampleHome";
import type { Data } from "./screens";

// The sample household of the artboards (Main wins where two disagree): Chore and Resident names, the Energy and
// the Streak. It starts from signedInResident() and does not edit sampleHome.ts, whose values the e2e specs assert on.

// [id, name, category, effort, interval in days, demands, responsible Resident]: Chores.dc.html's 14 Chores in its 10 Categories.
// Efforts: Muito leve 1, Leve 2, Médio 3, Pesado 4.
const CHORES: [string, string, string, number, number, string[]?, string?][] = [
  ["louca", "Lavar a louça", "kitchen", 2, 1],
  ["fogao", "Limpar o fogão", "kitchen", 3, 3],
  ["pia", "Limpar a pia do banheiro", "bathroom", 2, 7, [], "resident-1"],
  ["box", "Limpar o box", "bathroom", 4, 7, ["strong_chemicals"]],
  ["cama", "Trocar a roupa de cama", "bedroom", 3, 7],
  ["po", "Tirar o pó da sala", "living_room", 2, 7],
  ["lavar", "Lavar a roupa", "laundry", 3, 3],
  ["roupa", "Dobrar a roupa", "laundry", 2, 3],
  ["aspirar", "Aspirar a sala", "floors", 3, 3, [], "resident-2"],
  ["pano", "Passar pano no chão", "floors", 4, 7, ["bending"]],
  ["lixo", "Tirar o lixo", "trash", 1, 2],
  ["plantas", "Regar as plantas", "outdoor", 2, 2],
  ["areia", "Limpar a caixa de areia", "pets", 2, 2],
  ["papel", "Repor o papel higiênico", "other", 1, 7],
];

const chore = ([id, name, category, effort, intervalDays, demands = [], responsibleResidentId]: (typeof CHORES)[number]): Chore => ({
  id, name, category, demands, baseEffort: effort, importance: "normal", people: 1, intervalDays, allowedWeekdays: [], buildsUp: false, responsibleResidentId: responsibleResidentId ?? null,
});

const task = (id: string, due: string, reason: string, committed = false, lastDone?: PlanTask["lastDone"]): PlanTask => {
  const [, name, category, effort] = CHORES.find(([c]) => c === id)!;
  return { id: `task-${id}`, choreId: id, choreName: name, windowStart: "2030-01-14", windowEnd: due, currentEffort: effort, baseEffort: effort, importance: "normal", people: 1, reason, category, committed, ...(lastDone && { lastDone }) };
};

function plan(done: boolean): DayPlan {
  return {
    date: "2030-01-15",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "template",
    energy: 4, // the "low" Check-in below, as ENERGY_OF_LEVEL in mocks/handlers/today.ts
    mine: done ? [] : [task("louca", "2030-01-16", "fits_energy", false, { date: "2030-01-14", residentIds: ["resident-2"] }), task("lixo", "2030-01-16", "liked"), task("roupa", "2030-01-16", "deadline_today", true)],
    others: [{ residentId: "resident-2", tasks: [task("cama", "2030-01-16", "turn_taking", true)] }],
    pool: done ? [] : [task("plantas", "2030-01-15", "no_energy_left"), task("areia", "2030-01-16", "no_energy_left")],
    doneToday: [
      { id: "task-pia", choreName: "Limpar a pia do banheiro", completedAt: "2030-01-15T12:02:00Z", category: "bathroom", with: [] },
      ...(done ? ["louca", "lixo", "roupa"].map((id, i) => ({ id: `task-${id}`, choreName: CHORES.find(([c]) => c === id)![1], completedAt: `2030-01-15T12:1${i}:00Z`, category: CHORES.find(([c]) => c === id)![2], with: [] })) : []),
    ],
    swaps: { incoming: [], outgoing: [] },
  };
}

/** The FakeState a screen is shot with: the household above, shaped by what its `data` asks for. */
export function pairsHome(data: Data = "default", stored?: string): FakeState {
  const state = signedInResident();
  state.user = { ...state.user, displayName: "Abner", email: "abner@exemplo.com" };
  // Local times of 2030-01-15 (UTC-3) as the Resident artboard lists them: "Hoje" and "Ontem".
  state.residents = [
    { id: "resident-1", you: true, name: "Abner", photoUrl: null, streak: 6, doneToday: 1, completions: [{ id: "c-pia", choreName: "Limpar a pia do banheiro", category: "bathroom", completedAt: "2030-01-15T12:02:00Z" }] },
    {
      id: "resident-2", you: false, name: "Ana", photoUrl: null, streak: 11, doneToday: 2,
      completions: [
        { id: "c-fogao", choreName: "Limpar o fogão", category: "kitchen", completedAt: "2030-01-15T12:15:00Z" },
        { id: "c-aspirar", choreName: "Aspirar a sala", category: "floors", completedAt: "2030-01-15T11:40:00Z" },
        { id: "c-louca", choreName: "Lavar a louça", category: "kitchen", completedAt: "2030-01-14T23:10:00Z" },
        { id: "c-lavar", choreName: "Lavar a roupa", category: "laundry", completedAt: "2030-01-14T21:30:00Z", with: [{ id: "resident-1", name: "Abner" }] },
        { id: "c-areia", choreName: "Limpar a caixa de areia", category: "pets", completedAt: "2030-01-14T11:05:00Z" },
      ],
    },
  ];
  state.chores = data === "no-chores" ? [] : CHORES.map(chore);
  state.dayPlan = plan(data === "done");
  state.streak = data === "done" ? 7 : 6; // TodayDone: "foi para 7 dias"
  state.streakTodayGrew = data === "done";
  // Sunday the 9th to today; Saturday the 12th was a paused day. Streak.dc.html's week.
  const week = ["grew", "grew", "grew", "paused", "grew", "grew", data === "done" ? "grew" : "open"] as const;
  state.streakWeek = week.map((s, i) => ({ date: `2030-01-${String(9 + i).padStart(2, "0")}`, state: s }));
  state.voiceRemaining = 4;
  state.checkIn = data === "unchecked" ? uncheckedDay() : { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
  if (data === "onboarding") {
    // With `stored` the Home exists and that step is done; without it the Resident has no Home yet.
    if (!stored) state.home = null;
    state.onboardingStored = stored ?? null;
  }
  return state;
}
