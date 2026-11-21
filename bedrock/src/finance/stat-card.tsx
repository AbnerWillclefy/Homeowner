import type { ReactNode } from "react";
import { Card, CardContent, CardLabel } from "../components/card";
import { Amount } from "./amount";

type StatCardProps = {
  label: string;
  cents: number;
  /** Cents, shown rounded and muted beside the value. */
  reference?: number;
  /** `hero` sits on the hero Card; at most one per screen. */
  size?: "lg" | "hero";
  /** The app passes a Badge with an icon and a sign, so the delta never relies on colour alone. */
  delta?: ReactNode;
  hint?: string;
  locale?: string;
  currency?: string;
} & ({ hidden?: false; hiddenLabel?: never } | { hidden: true; hiddenLabel: string });

export function StatCard({ label, cents, reference, size = "lg", delta, hint, locale, currency, hidden, hiddenLabel }: StatCardProps) {
  const money = { cents, reference, size, locale, currency } as const;
  return (
    <Card variant={size === "hero" ? "hero" : "default"}>
      <CardLabel>{label}</CardLabel>
      <CardContent>
        {hidden ? <Amount {...money} hidden hiddenLabel={hiddenLabel} /> : <Amount {...money} />}
        {delta && <div className="flex">{delta}</div>}
        {hint && <p className="caption text-text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}
