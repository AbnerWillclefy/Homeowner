/** The in-store check-offs of this device (item ids), under one key: the shopping list reads them and a new receipt clears them. */
export const CHECKED_KEY = "revenue.pantry.checked";

export function readChecked(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function writeChecked(ids: string[]): void {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or a full store: a tick that is not kept is only a tick.
  }
}

export function clearChecked(): void {
  try {
    localStorage.removeItem(CHECKED_KEY);
  } catch {
    // As above.
  }
}
