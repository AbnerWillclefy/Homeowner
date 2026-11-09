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

/**
 * `POST /home/voice/interpret`, answering by the words of the transcript: "nothing" is nothing understood, "many" is
 * too many, anything else proposes creating two Chores, "Water the plants" and "Sweep the porch". Like the real
 * endpoint it changes nothing itself. Not part of `signedInHandlers`: a spec opts in with `fakeApi.use(voiceHandlers)`.
 */
export function voiceHandlers(api: FakeApi): void {
  api.on(
    "POST /home/voice/interpret",
    signedIn((request) => {
      const transcript = String((request.body as { transcript?: unknown } | null)?.transcript ?? "");
      if (transcript.includes("nothing")) return json(200, { status: "nothing_understood", actions: [], remaining: 9 });
      if (transcript.includes("many")) return json(200, { status: "too_many", actions: [], remaining: 9 });
      return json(200, { status: "ok", actions: [create("Water the plants"), create("Sweep the porch")], remaining: 9 });
    }),
  );
}
