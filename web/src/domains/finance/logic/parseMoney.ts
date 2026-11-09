const MAX_CENTS = 1_000_000_000_000n; // backend maxBillCents

/**
 * Money typed by a person, as cents, or null when it is not a positive amount with at most two decimals.
 * pt-BR writes `1.234,56` and en-US `1,234.56`; "R$" and spaces are allowed. Works on the digit string, never a float.
 */
export function parseMoney(text: string, locale: string): number | null {
  const [group, decimal] = locale.startsWith("pt") ? ["\\.", ","] : [",", "\\."];
  const cleaned = text.replace(/R\$|\s/g, "");
  const match = new RegExp(`^(\\d{1,3}(?:${group}\\d{3})+|\\d+)(?:${decimal}(\\d{1,2}))?$`).exec(cleaned);
  if (!match) return null;
  const whole = (match[1] ?? "").replace(new RegExp(group, "g"), "");
  const cents = BigInt(whole) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return cents === 0n || cents > MAX_CENTS ? null : Number(cents);
}
