import { describe, expect, it } from "vitest";
import { clampCount, emptyAnswers, initialAnswers, ROOM_LIMITS, toRequestBody, withDayToggled } from "./answers";

describe("toRequestBody", () => {
  it("sends nothing for answers that say none, since a missing section means none", () => {
    expect(toRequestBody(emptyAnswers())).toEqual({});
  });

  it("sends each section that has an answer and leaves the others out", () => {
    const answers = { ...emptyAnswers(), outdoor: "yard", pets: ["dog", "cat"] };
    expect(toRequestBody(answers)).toEqual({ outdoor: "yard", pets: ["dog", "cat"] });
  });

  it("sends all the room counts once any room is counted", () => {
    const answers = { ...emptyAnswers(), rooms: { ...emptyAnswers().rooms, bathrooms: 2 } };
    expect(toRequestBody(answers)).toEqual({
      rooms: { bedrooms: 0, bathrooms: 2, kitchens: 0, livingRooms: 0, laundryAreas: 0 },
    });
  });

  it("sends collection days as 0 = Sunday wire numbers, in order, for the stream that has some", () => {
    const answers = { ...emptyAnswers(), collection: { trash: [5, 2], recycling: [] } };
    expect(toRequestBody(answers)).toEqual({ collection: { trash: [2, 5], recycling: [] } });
  });

  it("sends habits once any differs from the default", () => {
    const answers = { ...emptyAnswers(), habits: { cooking: "daily", dishwasher: false, washingMachine: false } };
    expect(toRequestBody(answers)).toEqual({ habits: { cooking: "daily", dishwasher: false, washingMachine: false } });
    const appliance = { ...emptyAnswers(), habits: { cooking: "sometimes", dishwasher: true, washingMachine: false } };
    expect(toRequestBody(appliance).habits?.dishwasher).toBe(true);
  });

  it("does not share the state's lists with the body", () => {
    const answers = { ...emptyAnswers(), pets: ["dog"] };
    expect(toRequestBody(answers).pets).not.toBe(answers.pets);
  });
});

describe("initialAnswers", () => {
  it("starts with one of each common room and nothing else", () => {
    expect(toRequestBody(initialAnswers())).toEqual({
      rooms: { bedrooms: 1, bathrooms: 1, kitchens: 1, livingRooms: 1, laundryAreas: 0 },
    });
  });
});

describe("clampCount", () => {
  it("reads whole numbers within the room's limit", () => {
    expect(clampCount("3", ROOM_LIMITS.bathrooms)).toBe(3);
    expect(clampCount("11", ROOM_LIMITS.bathrooms)).toBe(10);
    expect(clampCount("5", ROOM_LIMITS.kitchens)).toBe(3);
  });

  it("reads a blank, a negative or text as zero, and drops decimals", () => {
    expect(clampCount("", 10)).toBe(0);
    expect(clampCount("-2", 10)).toBe(0);
    expect(clampCount("abc", 10)).toBe(0);
    expect(clampCount("2.7", 10)).toBe(2);
  });
});

describe("withDayToggled", () => {
  it("adds a day and removes it again, keeping the list sorted", () => {
    expect(withDayToggled([5], 2)).toEqual([2, 5]);
    expect(withDayToggled([2, 5], 5)).toEqual([2]);
  });
});
