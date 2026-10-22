import type { Resident, ResidentDetail } from "../api/api";

/** A Resident of the list for tests. */
export function resident(id: string, name: string): Resident {
  return { id, you: false, name, photoUrl: null, initials: name.slice(0, 2).toUpperCase(), avatarTone: "kitchen", streak: 0, doneToday: 0 };
}

/** One Resident's page data for tests. */
export function residentDetail(id: string, name: string, you = false): ResidentDetail {
  return {
    date: "2030-01-15",
    id,
    you,
    name,
    photoUrl: null,
    initials: name.slice(0, 2).toUpperCase(),
    avatarTone: "kitchen",
    streak: 3,
    doneLast7Days: 2,
    days: [],
  };
}
