import type { Preference, Profile, Weekday } from "../api/profile";

// Pure copies of the profile for the optimistic update. The screen keeps the old one to roll back to.

export function withBaseline(profile: Profile, day: Weekday, points: number | null): Profile {
  return { ...profile, baseline: { ...profile.baseline, [day]: points } };
}

/** Neutral is stored as no entry, like the API. */
export function withPreference(profile: Profile, category: string, preference: Preference): Profile {
  const rest = { ...profile.preferences };
  delete rest[category];
  return { ...profile, preferences: preference === "neutral" ? rest : { ...rest, [category]: preference } };
}

export function withRestriction(profile: Profile, demand: string, restricted: boolean): Profile {
  const others = profile.restrictions.filter((d) => d !== demand);
  return { ...profile, restrictions: restricted ? [...others, demand] : others };
}
