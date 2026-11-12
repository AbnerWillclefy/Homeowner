import { useEffect, useRef, useState } from "react";
import { Field, fieldClass } from "../components/field";
import { cn } from "../lib/cn";
import { parseCents } from "./lib/money";

const format = (cents: number | null, locale: string) =>
  cents === null
    ? ""
    : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);

/**
 * An amount field that yields integer cents (null when empty or invalid). Zero is a valid amount:
 * a limit or goal field that cannot take zero passes `error`.
 */
export function MoneyInput({
  label,
  value,
  onValueChange,
  hint,
  error,
  locale = "pt-BR",
  currency = "BRL",
}: {
  label: string;
  value: number | null;
  onValueChange: (cents: number | null) => void;
  hint?: string;
  error?: string;
  locale?: string;
  currency?: string;
}) {
  const [text, setText] = useState(() => format(value, locale));
  const focused = useRef(false);

  // Typing keeps value === parseCents(text), so while focused only an outside change differs;
  // syncing just then keeps the caret still as the Resident types.
  useEffect(() => {
    if (!focused.current || value !== parseCents(text)) setText(format(value, locale));
  }, [value, locale, text]);
  const symbol =
    new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
      ?.value ?? currency;

  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <div className="relative">
          <span aria-hidden className="value-md pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted">
            {symbol}
          </span>
          <input
            {...control}
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={() => (focused.current = true)}
            onChange={(e) => {
              setText(e.target.value);
              onValueChange(parseCents(e.target.value));
            }}
            onBlur={() => {
              focused.current = false;
              const cents = parseCents(text);
              if (cents !== null) setText(format(cents, locale));
            }}
            className={cn(fieldClass(!!error), "value-md h-control-lg pointer-coarse:text-xl tabular-nums pl-12")}
          />
        </div>
      )}
    </Field>
  );
}
