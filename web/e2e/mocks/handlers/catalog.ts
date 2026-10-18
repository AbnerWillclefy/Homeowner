import type { AnswersBody, Proposal } from "../../../src/domains/catalog/api/api";
import { COOKINGS, OUTDOORS, PETS, ROOM_LIMITS, type RoomType } from "../../../src/domains/catalog/logic/answers";
import { json, signedIn, type FakeApi } from "../api";

type Fields = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks the answers like `normalise` in backend/internal/catalog/answers.go: stable codes keyed like `rooms.bathrooms`. */
function answerErrors(body: Record<string, unknown>): Fields {
  const fields: Fields = {};
  const add = (field: string, code: string) => {
    fields[field] ??= code;
  };
  const whole = (value: unknown, field: string, hi: number) => {
    if (typeof value !== "number" || !Number.isInteger(value)) add(field, "invalid");
    else if (value < 0 || value > hi) add(field, "out_of_range");
  };

  if (isRecord(body["rooms"])) {
    for (const type of Object.keys(ROOM_LIMITS) as RoomType[]) {
      const count = body["rooms"][type];
      if (count !== undefined && count !== null) whole(count, `rooms.${type}`, ROOM_LIMITS[type]);
    }
  }
  const outdoor = body["outdoor"];
  if (outdoor !== undefined && outdoor !== "" && !(OUTDOORS as readonly unknown[]).includes(outdoor)) add("outdoor", "unknown");
  const pets = body["pets"];
  if (Array.isArray(pets) && pets.some((pet) => !(PETS as readonly unknown[]).includes(pet))) add("pets", "unknown");
  if (isRecord(body["collection"])) {
    for (const stream of ["trash", "recycling"]) {
      const days = body["collection"][stream];
      if (Array.isArray(days)) for (const day of days) whole(day, `collection.${stream}`, 6);
    }
  }
  if (isRecord(body["habits"])) {
    const cooking = body["habits"]["cooking"];
    if (cooking !== undefined && cooking !== "" && !(COOKINGS as readonly unknown[]).includes(cooking)) add("habits.cooking", "unknown");
  }
  return fields;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function proposal(catalogId: string, instance: number | null, fields: Omit<Proposal, "catalogId" | "instance">): Proposal {
  return { catalogId, instance, ...fields };
}

/** A Chore once for each room, numbered 1..n when there are several (instance null for one). */
function perRoom(count: number, make: (instance: number | null) => Proposal): Proposal[] {
  if (count === 1) return [make(null)];
  return Array.from({ length: count }, (_, index) => make(index + 1));
}

/**
 * The proposals for the answers: small, deterministic and driven by the answers, so what a spec types changes what
 * comes back. Not the real Catalog; the ids are real ones the app has names for. The names are English fallback
 * text, because the app builds the shown name from `catalogId`.
 */
function propose(body: AnswersBody): Proposal[] {
  const rooms = body.rooms;
  const proposals: Proposal[] = [];
  proposals.push(
    ...perRoom(rooms?.bedrooms ?? 0, (n) =>
      proposal("change_bed_linen", n, { name: "Change the bed linen", category: "bedroom", demands: ["bending"], baseEffort: 2, importance: "normal", people: 1, intervalDays: 14, allowedWeekdays: ALL_DAYS, buildsUp: true }),
    ),
    ...perRoom(rooms?.kitchens ?? 0, (n) =>
      proposal("clean_kitchen", n, { name: "Clean the kitchen", category: "kitchen", demands: [], baseEffort: 3, importance: "essential", people: 1, intervalDays: 3, allowedWeekdays: ALL_DAYS, buildsUp: true }),
    ),
    ...perRoom(rooms?.bathrooms ?? 0, (n) =>
      proposal("clean_bathroom", n, { name: "Clean the bathroom", category: "bathroom", demands: ["bending", "strong_chemicals"], baseEffort: 3, importance: "essential", people: 1, intervalDays: 7, allowedWeekdays: [0, 6], buildsUp: true }),
    ),
    ...perRoom(rooms?.livingRooms ?? 0, (n) =>
      proposal("tidy_living_room", n, { name: "Tidy the living room", category: "living_room", demands: [], baseEffort: 1, importance: "nice_to_have", people: 1, intervalDays: 2, allowedWeekdays: ALL_DAYS, buildsUp: false }),
    ),
    ...perRoom(rooms?.laundryAreas ?? 0, (n) =>
      proposal("clean_laundry_area", n, { name: "Clean the laundry area", category: "laundry", demands: [], baseEffort: 2, importance: "normal", people: 1, intervalDays: 30, allowedWeekdays: ALL_DAYS, buildsUp: false }),
    ),
  );
  if (body.pets?.includes("dog")) {
    proposals.push(
      proposal("walk_dog", null, { name: "Walk the dog", category: "pets", demands: [], baseEffort: 2, importance: "essential", people: 1, intervalDays: 1, allowedWeekdays: ALL_DAYS, buildsUp: false }),
    );
  }
  return proposals;
}

/** `POST /catalog/proposals`. `GET /catalog` is not here: onboarding never reads the whole Catalog. */
export function catalogHandlers(api: FakeApi): void {
  api.on(
    "POST /catalog/proposals",
    signedIn((request) => {
      if (!isRecord(request.body)) return json(400, { error: "invalid answers" });
      const fields = answerErrors(request.body);
      if (Object.keys(fields).length > 0) return json(400, { error: "invalid answers", fields });
      return json(200, { proposals: propose(request.body as AnswersBody) });
    }),
  );
}

export { propose as proposalsFor };
