import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billSuggestionsQuery, dismissSuggestion } from "../api/queries";

/** The suggested Bills (empty while loading or when the read failed: the card is only an offer) and the dismissal. */
export function useBillSuggestions() {
  const client = useQueryClient();
  const { data } = useQuery(billSuggestionsQuery);
  const dismiss = useCallback((merchantKey: string) => dismissSuggestion(client, merchantKey), [client]);
  return { suggestions: data ?? [], dismiss };
}
