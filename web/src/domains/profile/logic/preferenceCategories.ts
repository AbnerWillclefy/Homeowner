/** The Categories a Resident can set a Preference on. Other is left out; a stored Preference on it still counts. */
export const preferenceCategories = (ids: readonly string[]): string[] => ids.filter((id) => id !== "other");
