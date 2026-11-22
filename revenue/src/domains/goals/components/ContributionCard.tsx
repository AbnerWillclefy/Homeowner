import { Button, Card, CardContent, CardHeader, CardLabel, Input, SegmentedControl } from "@homeowner/bedrock";
import { Amount, formatAmount, MoneyInput } from "@homeowner/bedrock/finance";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../../shared/useMediaQuery";
import { useMonthParam } from "../../../shared/month/useMonthParam";
import type { Savings } from "../api";
import type { SaveOutcome } from "../hooks/useSavings";
import { contributionOf, shareOptions, splitContribution, splitParts } from "../logic/savings";
import { SettingSheet } from "./SettingSheet";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

type Write = (value: { baseCents: number; reserveSharePercent: number } | null) => Promise<SaveOutcome>;

/** Aporte do mês: how much is saved each month, the reserve's share of it (pick one, or change it in the sheet) and where it goes. */
export function ContributionCard({ savings, save, className }: { savings: Savings; save: Write; className?: string }) {
  const { t, locale } = useI18n();
  const { thisMonth } = useMonthParam();
  const hide = useHiddenProps();
  const desktop = useMediaQuery(DESKTOP);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const { contributionBaseCents: base, reserveSharePercent: share } = savings;
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(`${thisMonth}-01T12:00:00`));
  const parts = splitParts({ name: t("goals.reserve.title"), cents: savings.reserve.monthCents }, savings.goals);
  const total = parts.reduce((sum, p) => sum + p.cents, 0);
  // Percentages, not money, so the spoken split does not give away hidden amounts.
  const splitLabel = `${t("goals.contribution.split")}: ${parts.map((p) => `${p.name} ${Math.round((p.cents / total) * 100)}%`).join(", ")}`;
  return (
    <Card className={className}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardLabel>{base !== null && share !== null ? t("goals.contribution.month", { month }) : t("goals.contribution.title")}</CardLabel>
        {base !== null && share !== null && (
          <div className="flex items-center gap-2 max-desktop:w-full max-desktop:flex-col max-desktop:items-stretch">
            <span className="body text-text-muted">{t("goals.contribution.reserveTakes")}</span>
            <SegmentedControl
              label={t("goals.contribution.share")}
              block={!desktop}
              value={String(share)}
              options={shareOptions(share).map((v) => ({ value: String(v), label: `${v}%` }))}
              onValueChange={(v) => void save({ baseCents: base, reserveSharePercent: Number(v) }).then((r) => setFailed(r.kind !== "ok"))}
            />
          </div>
        )}
      </CardHeader>
      {base !== null && share !== null ? (
        <>
          {failed && <p role="alert" className="caption text-danger">{t("goals.failed")}</p>}
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Amount cents={base} size="lg" locale={locale} {...hide} />
            <span className="caption text-text-muted">{t("goals.contribution.perMonth")}</span>
          </p>
          {total > 0 && (
            <>
              <div role="img" aria-label={splitLabel} className="flex h-4 gap-1">
                {parts.map((p) => (
                  <div key={p.id} className="rounded-xs" style={{ width: `${(p.cents / total) * 100}%`, background: p.color }} />
                ))}
              </div>
              <ul className="flex flex-col gap-2">
                {parts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3">
                    <span className="body flex min-w-0 items-center gap-2 text-text-muted">
                      <i aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: p.color }} />
                      <span className="[overflow-wrap:anywhere]">{p.name}</span>
                    </span>
                    <Amount cents={p.cents} size="sm" locale={locale} {...hide} />
                  </li>
                ))}
              </ul>
            </>
          )}
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
