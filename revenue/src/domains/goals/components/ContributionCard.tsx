import { Button, Card, CardContent, CardHeader, CardLabel, Input } from "@homeowner/bedrock";
import { Amount, formatAmount, MoneyInput } from "@homeowner/bedrock/finance";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Savings } from "../api";
import type { SaveOutcome } from "../hooks/useSavings";
import { contributionOf, splitContribution } from "../logic/savings";
import { SettingSheet } from "./SettingSheet";

type Write = (value: { baseCents: number; reserveSharePercent: number } | null) => Promise<SaveOutcome>;

/** Aporte mensal: how much is saved each month and the reserve's share of it. Set and changed in a sheet. */
export function ContributionCard({ savings, save }: { savings: Savings; save: Write }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const { contributionBaseCents: base, reserveSharePercent: share } = savings;
  const split = base !== null && share !== null ? splitContribution(base, share) : null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardLabel>{t("goals.contribution.title")}</CardLabel>
      </CardHeader>
      {split && base !== null && share !== null ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Amount cents={base} size="lg" locale={locale} />
            <span className="caption text-text-muted">{t("goals.contribution.perMonth")}</span>
          </p>
          <ul className="divide-y divide-border">
            {[
              [t("goals.contribution.reserveRow", { percent: share }), split.reserveCents],
              [t("goals.contribution.goalsRow"), split.goalsCents],
            ].map(([label, cents]) => (
              <li key={label} className="flex flex-wrap items-center justify-between gap-x-3 py-2">
                <span className="body [overflow-wrap:anywhere]">{label}</span>
                <Amount cents={cents as number} size="sm" locale={locale} />
              </li>
            ))}
          </ul>
          <Button variant="secondary" icon={Pencil} className="self-start" onClick={() => setOpen(true)}>
            {t("goals.contribution.change")}
          </Button>
        </>
      ) : (
        <CardContent>
          <p className="body text-text-muted">{t("goals.contribution.empty")}</p>
          <Button className="self-start" onClick={() => setOpen(true)}>
            {t("goals.contribution.set")}
          </Button>
        </CardContent>
      )}
      {open && <ContributionSheet base={base} share={share} save={save} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function ContributionSheet({ base, share, save, onClose }: { base: number | null; share: number | null; save: Write; onClose(): void }) {
  const { t, locale } = useI18n();
  const [cents, setCents] = useState<number | null>(base);
  const [typedShare, setTypedShare] = useState(share === null ? "" : String(share));
  // The split is shown as it is typed, with the same rounding the API uses.
  const read = contributionOf({ cents, share: typedShare });
  return (
    <SettingSheet
      title={t("goals.contribution.title")}
      onClose={onClose}
      clear={base === null ? undefined : () => save(null)}
      submit={async () => {
        const result = contributionOf({ cents, share: typedShare });
        return result.ok ? save({ baseCents: result.baseCents, reserveSharePercent: result.reserveSharePercent }) : { kind: "fields", fields: result.errors };
      }}
    >
      {(error, saving) => (
        <>
          <MoneyInput label={t("goals.contribution.base")} value={cents} onValueChange={setCents} error={error("baseCents")} locale={locale} />
          <Input
            label={t("goals.contribution.share")}
            hint={t("goals.contribution.shareHint")}
            value={typedShare}
            onChange={(e) => setTypedShare(e.target.value)}
            error={error("reserveSharePercent")}
            inputMode="numeric"
            autoComplete="off"
            disabled={saving}
          />
          {/* Polite, so the User hears what the share means in money while typing, without it taking focus. */}
          <p aria-live="polite" className="body-strong [overflow-wrap:anywhere]">
            {read.ok && (() => {
              const split = splitContribution(read.baseCents, read.reserveSharePercent);
              return t("goals.contribution.preview", { reserve: formatAmount(split.reserveCents, { locale }), goals: formatAmount(split.goalsCents, { locale }) });
            })()}
          </p>
        </>
      )}
    </SettingSheet>
  );
}
