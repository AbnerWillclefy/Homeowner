/** The screens the chat API knows by name (`POST /me/finance/chat`); anything else is `other`. */
export const SCREEN_KEYS = ["overview", "transactions", "bills", "card_bills", "categories", "goals", "net_worth", "projection", "sources", "settings", "other"] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

/** The first path segment of each screen, so `/categories/groceries` is `categories`. */
const BY_SEGMENT: Record<string, ScreenKey> = {
  transactions: "transactions", bills: "bills", "card-bills": "card_bills", categories: "categories", goals: "goals",
  "net-worth": "net_worth", projection: "projection", sources: "sources", settings: "settings",
};

export function screenKeyOf(pathname: string): ScreenKey {
  if (pathname === "/") return "overview";
  const segment = pathname.split("/")[1] ?? "";
  return Object.hasOwn(BY_SEGMENT, segment) ? BY_SEGMENT[segment]! : "other";
}

/** The `from` query parameter: a missing or unknown value is `other`, so the request never carries a made-up key. */
export function parseFrom(param: string | null): ScreenKey {
  return SCREEN_KEYS.find((k) => k === param) ?? "other";
}

/** Where the way back goes: the screen the chat was opened from, or the Overview when that is unknown. */
export function pathOfScreenKey(key: ScreenKey): string {
  if (key === "other" || key === "overview") return "/";
  return `/${Object.keys(BY_SEGMENT).find((segment) => BY_SEGMENT[segment] === key)}`;
}
