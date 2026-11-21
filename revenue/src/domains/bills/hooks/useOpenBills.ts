import { useQuery } from "@tanstack/react-query";
import { saoPauloDay } from "../../../shared/month/month";
import { getBills } from "../api";
import { summarise } from "../logic/billState";
import { billsKey } from "./useBills";

/** The Bills of this month still to pay. Same query key as BillsPage, so marking one paid moves the badge at once. Undefined while loading or failed: never "0". */
export function useOpenBills(now: Date) {
  const month = saoPauloDay(now).slice(0, 7);
  const { data } = useQuery({ queryKey: billsKey(month), queryFn: () => getBills(month) });
  // Card bills from commitments are not counted: the badge counts the Bills to pay rows, as the Bills artboard does.
  return data && summarise(data).toPayCount;
}
