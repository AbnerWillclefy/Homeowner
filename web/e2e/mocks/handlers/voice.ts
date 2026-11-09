import type { ChoreWire } from "../../../src/domains/chores/api/api";
import { json, signedIn, type FakeApi } from "../api";

const chore = (name: string): ChoreWire => ({
  name,
  category: "outdoor",
  demands: [],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [],
  buildsUp: false,
});

const create = (name: string) => ({
  kind: "create_chore",
  choreName: name,
  request: { method: "POST", path: "/home/chores", body: chore(name) },
});

const complete = (id: string, name: string, kind = "complete") => ({
  kind,
  taskId: id,
  choreName: name,
  request: { method: "POST", path: `/home/tasks/${id}/${kind}` },
});

/**
 * `POST /home/voice/interpret`, answering by the words of the transcript: "nothing" is nothing understood, "many" is
 * too many, "unavailable" is 503, "limit" is 429, "slow" is 504, "laundry" is one action with two candidates, "three"
 * is three Task completions, "last" is the last command of the day (`remaining: 0`) and "few" leaves 2; anything else
 * proposes creating two Chores, "Water the plants" and "Sweep the porch". Like the real endpoint it changes nothing
 * itself. Not part of `signedInHandlers`: a spec opts in with `fakeApi.use(voiceHandlers)`.
 */
export function voiceHandlers(api: FakeApi): void {
  api.on(
    "POST /home/voice/interpret",
    signedIn((request) => {
      const transcript = String((request.body as { transcript?: unknown } | null)?.transcript ?? "");
      if (transcript.includes("unavailable")) return json(503, { error: "unavailable" });
      if (transcript.includes("limit")) return json(429, { error: "voice_daily_limit" });
      if (transcript.includes("slow")) return json(504, { error: "timeout" });
      if (transcript.includes("laundry")) {
        const candidates = [complete("task-a", "Laundry", "accept"), complete("task-b", "Laundry", "take")];
        return json(200, { status: "ok", actions: [{ candidates }], remaining: 9 });
      }
      if (transcript.includes("three")) {
        const actions = [complete("task-a", "Laundry"), complete("task-b", "Dishes"), complete("task-c", "Trash")];
        return json(200, { status: "ok", actions, remaining: 9 });
      }
      if (transcript.includes("last")) return json(200, { status: "ok", actions: [create("Water the plants")], remaining: 0 });
      if (transcript.includes("few")) return json(200, { status: "ok", actions: [create("Water the plants")], remaining: 2 });
      if (transcript.includes("nothing")) return json(200, { status: "nothing_understood", actions: [], remaining: 9 });
      if (transcript.includes("many")) return json(200, { status: "too_many", actions: [], remaining: 9 });
      return json(200, { status: "ok", actions: [create("Water the plants"), create("Sweep the porch")], remaining: 9 });
    }),
  );
}
