/** A bank's first two letters in a neutral badge; the artboard's per-bank brand colours are not tokens. */
export function BankMark({ name }: { name: string }) {
  return (
    <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-xs font-semibold text-text-muted">
      {name.trim().slice(0, 2)}
    </span>
  );
}
