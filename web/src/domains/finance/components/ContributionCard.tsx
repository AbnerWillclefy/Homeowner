import { useRef, useState, type RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import type { Savings } from "../api/api";
import { centsToInput, formatCents } from "../logic/money";
import { contributionOf, splitContribution } from "../logic/savings";
import { FinanceCard } from "./FinanceCard";
import { SavingsFormDialog } from "./SavingsFormDialog";

type Write = (value: { baseCents: number; reserveSharePercent: number } | null) => Promise<boolean>;

/** Aporte mensal: how much is saved each month and the reserve's share of it. Set and changed in a dialog. */
export function ContributionCard({ savings, save }: { savings: Savings; save: Write }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const { contributionBaseCents: base, reserveSharePercent: share } = savings;
  const set = base !== null && share !== null;
  const split = set ? splitContribution(base, share) : null;
  return (
    <FinanceCard id="finances-savings-contribution" title={t("finances.savings.contribution.title")}>
      {split && base !== null && share !== null ? (
        <>
          <p className="my-0">
            <span className="text-3xl font-bold [overflow-wrap:anywhere]">{formatCents(base, locale)}</span>{" "}
            <span className="text-muted">{t("finances.savings.contribution.perMonth")}</span>
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {[
              [t("finances.savings.contribution.reserveRow", { percent: share }), split.reserveCents],
              [t("finances.savings.contribution.goalsRow"), split.goalsCents],
            ].map(([label, cents]) => (
              <li key={label} className="flex flex-wrap justify-between gap-x-3 border-t border-chart-track pt-1 first:border-t-0 first:pt-0">
                <span className="[overflow-wrap:anywhere]">{label}</span>
                <span className="font-bold [overflow-wrap:anywhere]">{formatCents(cents as number, locale)}</span>
              </li>
            ))}
          </ul>
          <Button ref={opener} variant="link" className="self-end text-sm" onClick={() => setOpen(true)}>
            {t("finances.savings.contribution.change")}
          </Button>
        </>
      ) : (
        <>
          <p className="my-0">{t("finances.savings.contribution.empty")}</p>
          <Button ref={opener} className="self-start" onClick={() => setOpen(true)}>
            {t("finances.savings.contribution.set")}
          </Button>
        </>
      )}
      {open && <ContributionDialog base={base} share={share} save={save} returnFocusRef={opener} onClose={() => setOpen(false)} />}
    </FinanceCard>
  );
}

function ContributionDialog({
  base,
  share,
  save,
  returnFocusRef,
  onClose,
}: {
  base: number | null;
  share: number | null;
  save: Write;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
}) {
  const { t, locale } = useI18n();
  const [typedBase, setTypedBase] = useState(base === null ? "" : centsToInput(base, locale));
  const [typedShare, setTypedShare] = useState(share === null ? "" : String(share));
  // The split is shown as it is typed, with the same rounding the API uses.
  const read = contributionOf({ base: typedBase, share: typedShare }, locale);
  const preview = read.ok ? splitContribution(read.baseCents, read.reserveSharePercent) : null;
  return (
    <SavingsFormDialog
      title={t("finances.savings.contribution.title")}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      clear={base === null ? undefined : () => save(null)}
      save={async (data) => {
        const result = contributionOf({ base: String(data.get("baseCents") ?? ""), share: String(data.get("reserveSharePercent") ?? "") }, locale);
        if (!result.ok) return { kind: "fields", fields: result.errors };
        return (await save({ baseCents: result.baseCents, reserveSharePercent: result.reserveSharePercent })) ? { kind: "ok" } : { kind: "failed" };
      }}
    >
      {(field) => (
        <>
          {field("baseCents", t("finances.savings.contribution.base"), (p) => (
            <input {...p} type="text" inputMode="decimal" autoComplete="off" value={typedBase} onChange={(e) => setTypedBase(e.target.value)} />
          ))}
          {field(
            "reserveSharePercent",
            t("finances.savings.contribution.share"),
            (p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" value={typedShare} onChange={(e) => setTypedShare(e.target.value)} />,
            t("finances.savings.contribution.shareHint"),
          )}
          {/* Polite, so the User hears what the share means in money while typing, without it taking focus. */}
          <p aria-live="polite" className="my-0 font-semibold [overflow-wrap:anywhere]">
            {preview && t("finances.savings.contribution.preview", { reserve: formatCents(preview.reserveCents, locale), goals: formatCents(preview.goalsCents, locale) })}
          </p>
        </>
      )}
    </SavingsFormDialog>
  );
}
