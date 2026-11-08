/** Which tab a key moves to in a horizontal tablist that wraps around, or null when the key does not move. */
export function nextTab<T>(tabs: readonly T[], current: T, key: string): T | null {
  const at = tabs.indexOf(current);
  switch (key) {
    case "ArrowRight":
      return tabs[(at + 1) % tabs.length] ?? null;
    case "ArrowLeft":
      return tabs[(at - 1 + tabs.length) % tabs.length] ?? null;
    case "Home":
      return tabs[0] ?? null;
    case "End":
      return tabs[tabs.length - 1] ?? null;
    default:
      return null;
  }
}
