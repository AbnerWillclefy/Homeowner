import { useQuery } from "@tanstack/react-query";
import { getItem } from "../api";
import { pantryKey } from "./usePantry";

/** One item's detail. It shares the Pantry's key prefix, so a receipt that refreshes the Pantry refreshes this too. */
export const useItem = (id: string) => useQuery({ queryKey: [...pantryKey, "item", id], queryFn: () => getItem(id) });
