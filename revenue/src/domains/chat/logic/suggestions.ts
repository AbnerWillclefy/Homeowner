import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { Params } from "../../../shared/i18n/i18n";
import type { ScreenKey } from "./screenKeys";

export interface Suggestion {
  key: MessageKey;
  vars?: Params;
}

const SUGGESTIONS: Record<ScreenKey, readonly MessageKey[]> = {
  overview: ["chat.suggest.overview.1", "chat.suggest.overview.2", "chat.suggest.overview.3"],
  transactions: ["chat.suggest.transactions.1", "chat.suggest.transactions.2"],
  bills: ["chat.suggest.bills.1", "chat.suggest.bills.2"],
  card_bills: ["chat.suggest.card_bills.1", "chat.suggest.card_bills.2"],
  categories: ["chat.suggest.categories.1", "chat.suggest.categories.2"],
  goals: ["chat.suggest.goals.1", "chat.suggest.goals.2"],
  net_worth: ["chat.suggest.net_worth.1", "chat.suggest.net_worth.2"],
  projection: ["chat.suggest.projection.1", "chat.suggest.projection.2"],
  sources: ["chat.suggest.sources.1", "chat.suggest.sources.2"],
  settings: ["chat.suggest.settings.1", "chat.suggest.settings.2"],
  other: ["chat.suggest.other.1", "chat.suggest.other.2", "chat.suggest.other.3"],
};

/** The questions to offer on a screen. `goal` is the name of the first Goal when the savings are already cached; without one, Goals asks a generic question. */
export function suggestionsFor(screen: ScreenKey, goal: string | undefined): Suggestion[] {
  const list: Suggestion[] = SUGGESTIONS[screen].map((key) => ({ key }));
  if (screen === "goals" && goal) list[0] = { key: "chat.suggest.goals.named", vars: { goal } };
  return list;
}
