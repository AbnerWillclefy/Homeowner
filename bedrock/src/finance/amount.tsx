import { cn } from "../lib/cn";

type FormatOptions = {
  locale?: string;
  currency?: string;
  /** Adds a leading "+" to a positive amount. Spending gets no sign; negative cents keep the minus. */
  income?: boolean;
  /** `whole` drops the cents (the reference); `compact` is for axes and tooltips. */
  precision?: "cents" | "whole" | "compact";
};

const NBSP = " ";

function currencyFormat(locale: string, currency: string, extra?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, ...extra });
}

function symbolOf(locale: string, currency: string) {
  return currencyFormat(locale, currency).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
}

/** The only place money becomes text. Takes integer cents; dividing by 100 is exact enough for display. */
export function formatAmount(
  cents: number,
  { locale = "pt-BR", currency = "BRL", income = false, precision = "cents" }: FormatOptions = {},
): string {
  const value = cents / 100;
  const signDisplay = income ? "exceptZero" : "auto";
  if (precision === "cents") return currencyFormat(locale, currency, { signDisplay }).format(value);
  const abs = Math.abs(value);
  if (precision === "whole" || abs < 1000) {
    return currencyFormat(locale, currency, { maximumFractionDigits: 0, signDisplay }).format(value);
  }
  // 999_950 is where one-decimal thousands would round up to "1000k".
  if (abs >= 999_950) {
    return currencyFormat(locale, currency, { notation: "compact", maximumFractionDigits: 1, signDisplay }).format(value);
  }
  // Intl's compact notation gives "R$ 8 mil", not the spec's "R$ 8k", so thousands are built by hand.
  const sign = value < 0 ? "-" : income ? "+" : "";
  const thousands = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs / 1000);
  return `${sign}${symbolOf(locale, currency)}${NBSP}${thousands}k`;
}

const sizes = {
  hero: "value-hero",
  lg: "value-lg",
  md: "value-md",
  sm: "value-sm",
};

type AmountProps = {
  cents: number;
  size: keyof typeof sizes;
  income?: boolean;
  /** Cents, shown rounded and muted beside the value. */
  reference?: number;
  locale?: string;
  currency?: string;
  className?: string;
} & ({ hidden?: false; hiddenLabel?: never } | { hidden: true; hiddenLabel: string });

export function Amount({
  cents,
  size,
  income,
  reference,
  locale = "pt-BR",
  currency = "BRL",
  className,
  hidden,
  hiddenLabel,
}: AmountProps) {
  const value = cn("whitespace-nowrap", sizes[size]);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2 tabular-nums", className)}>
      {hidden ? (
        <>
          <span aria-hidden="true" className={cn(value, "tracking-[0.1em]")}>
            {symbolOf(locale, currency)}
            {NBSP}••••
          </span>
          <span className="sr-only">{hiddenLabel}</span>
        </>
      ) : (
        <>
          <span className={cn(value, income && "text-positive")}>{formatAmount(cents, { locale, currency, income })}</span>
          {reference !== undefined && (
            <span className="whitespace-nowrap font-medium text-text-muted text-[14px] tracking-normal">
              / {formatAmount(reference, { locale, currency, precision: "whole" })}
            </span>
          )}
        </>
      )}
    </span>
  );
}
