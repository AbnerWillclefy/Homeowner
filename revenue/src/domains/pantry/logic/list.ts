import type { ShoppingList, ShoppingListItem } from "../api";

/** How long a burst of taps on a stepper waits before one write carries its final value. */
export const WRITE_DELAY_MS = 500;

/** How much the expected total is over what is left of the groceries limit; null when it is not, or with no limit. A negative left counts. */
export const overBy = (totalCents: number, leftCents: number | undefined): number | null =>
  leftCents !== undefined && totalCents > leftCents ? totalCents - leftCents : null;

/** The Stepper's step and minimum in thousandths: a count steps by 1, a weight by 0,1 kg. */
export const stepFor = (unit: string): { step: number; min: number } => (unit === "KG" ? { step: 100, min: 100 } : { step: 1000, min: 1000 });

/** "2" for a count, "0,450 kg" for a weight, "1,5 cx" for another unit: thousandths of the unit, in the locale's number format. */
export function quantityLabel(quantityMilli: number, unit: string, locale: string): string {
  const weight = unit === "KG";
  const digits = weight ? 3 : 0;
  const text = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: 3 }).format(quantityMilli / 1000);
  return unit === "UN" ? text : `${text} ${unit.toLowerCase()}`;
}

/** Ticks of items that left the list are dropped. */
export const pruneChecked = (ids: string[], items: ShoppingListItem[]): string[] => ids.filter((id) => items.some((i) => i.itemId === id));

export const unpricedCount = (items: ShoppingListItem[]): number => items.filter((i) => i.priceCents === undefined).length;

/** The list as it will be once a quantity is saved: the line repriced and the total moved by the difference. */
export function withQuantity(list: ShoppingList, itemId: string, quantityMilli: number): ShoppingList {
  let delta = 0;
  const items = list.items.map((i) => {
    if (i.itemId !== itemId) return i;
    if (i.unitPriceCents === undefined) return { ...i, quantityMilli };
    const priceCents = Math.round((i.unitPriceCents * quantityMilli) / 1000);
    delta = priceCents - (i.priceCents ?? 0);
    return { ...i, quantityMilli, priceCents };
  });
  return { ...list, items, expectedTotalCents: list.expectedTotalCents + delta };
}

/** The list as it will be once an item is removed. */
export function withoutItem(list: ShoppingList, itemId: string): ShoppingList {
  const gone = list.items.find((i) => i.itemId === itemId);
  return gone ? { ...list, items: list.items.filter((i) => i !== gone), expectedTotalCents: list.expectedTotalCents - (gone.priceCents ?? 0) } : list;
}
