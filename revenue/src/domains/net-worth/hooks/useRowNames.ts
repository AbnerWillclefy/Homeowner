import { useSavings } from "../../goals/hooks/useSavings";
import { useSources } from "../../sources/hooks/useSources";

/** The names the three parts rows show under their titles. Each read stands alone: one that fails leaves its row without names, never the screen without a page. */
export function useRowNames() {
  const savings = useSavings().data;
  const sources = useSources().data?.sources;
  return {
    investments: savings?.investments.map((i) => i.name),
    accounts: sources?.filter((s) => s.kind !== "credit_card").map((s) => s.name),
    cards: sources?.filter((s) => s.kind === "credit_card").map((s) => s.name),
  };
}
