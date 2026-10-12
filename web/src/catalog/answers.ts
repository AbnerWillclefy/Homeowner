import type { AnswersBody } from "./api";
import type { MessageKey } from "../shared/i18n";

/** The room types and their limits, as the API takes them (backend/internal/catalog/answers.go). */
export const ROOM_LIMITS = {
  bedrooms: 10,
  bathrooms: 10,
  kitchens: 3,
  livingRooms: 10,
  laundryAreas: 10,
} as const;

export type RoomType = keyof typeof ROOM_LIMITS;

export const ROOM_TYPES = Object.keys(ROOM_LIMITS) as RoomType[];

export const ROOM_LABEL_KEYS = {
  bedrooms: "catalog.rooms.bedrooms",
  bathrooms: "catalog.rooms.bathrooms",
  kitchens: "catalog.rooms.kitchens",
  livingRooms: "catalog.rooms.livingRooms",
  laundryAreas: "catalog.rooms.laundryAreas",
} as const satisfies Record<RoomType, MessageKey>;

export const OUTDOORS = ["none", "balcony", "yard", "garden"] as const;
export const PETS = ["dog", "cat", "fish", "bird", "other"] as const;
export const COOKINGS = ["rarely", "sometimes", "daily"] as const;

export const OUTDOOR_LABEL_KEYS = {
  none: "catalog.outdoor.none",
  balcony: "catalog.outdoor.balcony",
  yard: "catalog.outdoor.yard",
  garden: "catalog.outdoor.garden",
} as const satisfies Record<(typeof OUTDOORS)[number], MessageKey>;

export const PET_LABEL_KEYS = {
  dog: "catalog.pets.dog",
  cat: "catalog.pets.cat",
  fish: "catalog.pets.fish",
  bird: "catalog.pets.bird",
  other: "catalog.pets.other",
} as const satisfies Record<(typeof PETS)[number], MessageKey>;

export const COOKING_LABEL_KEYS = {
  rarely: "catalog.habits.cooking.rarely",
  sometimes: "catalog.habits.cooking.sometimes",
  daily: "catalog.habits.cooking.daily",
} as const satisfies Record<(typeof COOKINGS)[number], MessageKey>;

/** What the questionnaire holds as the Resident fills it in. */
export interface AnswersState {
  rooms: Record<RoomType, number>;
  outdoor: string;
  pets: string[];
  /** Weekdays 0 to 6 with 0 = Sunday, as on the wire. */
  collection: { trash: number[]; recycling: number[] };
  habits: { cooking: string; dishwasher: boolean; washingMachine: boolean };
}

/** Answers that say none: what the API assumes for a part that is left out. */
export function emptyAnswers(): AnswersState {
  return {
    rooms: { bedrooms: 0, bathrooms: 0, kitchens: 0, livingRooms: 0, laundryAreas: 0 },
    outdoor: "none",
    pets: [],
    collection: { trash: [], recycling: [] },
    habits: { cooking: "sometimes", dishwasher: false, washingMachine: false },
  };
}

/** What the form shows first: one of each common room, so most Homes only need to change a number or two. */
export function initialAnswers(): AnswersState {
  return { ...emptyAnswers(), rooms: { bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, laundryAreas: 0 } };
}

const sortedDays = (days: readonly number[]) => [...new Set(days)].sort((a, b) => a - b);

/**
 * The request body for the answers. A part that says none is left out, because the API reads a missing
 * part as none, so the body only carries what the Resident actually told us.
 */
export function toRequestBody(answers: AnswersState): AnswersBody {
  const body: AnswersBody = {};
  if (ROOM_TYPES.some((type) => answers.rooms[type] > 0)) body.rooms = { ...answers.rooms };
  if (answers.outdoor !== "none") body.outdoor = answers.outdoor;
  if (answers.pets.length > 0) body.pets = [...answers.pets];
  if (answers.collection.trash.length > 0 || answers.collection.recycling.length > 0) {
    body.collection = { trash: sortedDays(answers.collection.trash), recycling: sortedDays(answers.collection.recycling) };
  }
  const { cooking, dishwasher, washingMachine } = answers.habits;
  if (cooking !== "sometimes" || dishwasher || washingMachine) body.habits = { cooking, dishwasher, washingMachine };
  return body;
}

/** A room count from what was typed: a whole number from 0 to the limit. Anything else reads as 0. */
export function clampCount(text: string, max: number): number {
  const n = Math.trunc(Number(text));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** The days with `day` added when absent and removed when present, in order. */
export function withDayToggled(days: readonly number[], day: number): number[] {
  return sortedDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
}

const ANSWER_ERROR_KEYS: Record<string, MessageKey> = {
  invalid: "catalog.answers.error.invalid",
  out_of_range: "catalog.answers.error.out_of_range",
  unknown: "catalog.answers.error.unknown",
};

/** The message for an answer's error code. A code this app does not know still gets a message. */
export function answerErrorKey(code: string): MessageKey {
  return ANSWER_ERROR_KEYS[code] ?? "catalog.answers.error.invalid";
}
