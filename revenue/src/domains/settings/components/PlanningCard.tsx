import { Banner, Card, Input, SegmentedControl, Button } from "@homeowner/bedrock";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { goalFieldErrorKey, contributionOf, reserveTargetOf } from "../../goals/logic/savings";
import { useSavings } from "../../goals/hooks/useSavings";
import { useIncome } from "../hooks/useFinanceSettings";
import { readIncome } from "../logic/income";
import { MoneyField } from "./MoneyField";

const PRESETS = [30, 50, 70];
const OTHER = "other";
const DEFAULT_SHARE = 50; // used when the contribution is first set from here, before any share was chosen

/**
 * Planejamento: income, the monthly contribution, the reserve target and the reserve's share of the contribution.
 * The last three are the Goals screen's settings, read and written through the same `useSavings` query, so the two screens never disagree.
 */
export function PlanningCard() {
  const { t } = useI18n();
  const { income, loading: incomeLoading, failed: incomeFailed, save: saveIncome } = useIncome();
  const savings = useSavings();
  const data = savings.data;
  const money = (cents: number | null) => {
    const read = reserveTargetOf(cents);
    return read.ok ? null : t(goalFieldErrorKey("targetCents", "invalid"));
  };
  return (
    <Card className="gap-4">
      <h2 className="section-title">{t("settings.plan.title")}</h2>
      {incomeFailed || savings.failed ? (
        <Banner tone="danger">{t("settings.plan.loadFailed")}</Banner>
      ) : (
        !incomeLoading &&
        data && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-6">
            <MoneyField
              label={t("settings.income.field")}
              hint={t("settings.plan.incomeHint")}
              saved={income ?? null}
              clearable
              check={(c) => {
                const read = readIncome(c);
                return "problem" in read ? t(`settings.income.${read.problem}`) : null;
              }}
              save={saveIncome}
            />
            <MoneyField
              label={t("goals.contribution.base")}
              hint={t("settings.plan.contributionHint")}
              saved={data.contributionBaseCents}
              check={money}
              save={async (c) => (await savings.saveContribution(c === null ? null : { baseCents: c, reserveSharePercent: data.reserveSharePercent ?? DEFAULT_SHARE })).kind === "ok"}
            />
            <MoneyField
              label={t("settings.plan.reserveTarget")}
              saved={data.reserveTargetCents}
              check={money}
              save={async (c) => (await savings.saveReserve(c)).kind === "ok"}
            />
            <ShareField base={data.contributionBaseCents} share={data.reserveSharePercent} save={(p) => savings.saveContribution(p)} />
          </div>
        )
      )}
    </Card>
  );
}

function ShareField({ base, share, save }: { base: number | null; share: number | null; save(value: { baseCents: number; reserveSharePercent: number }): ReturnType<ReturnType<typeof useSavings>["saveContribution"]> }) {
  const { t } = useI18n();
  const [other, setOther] = useState(false);
  const [typed, setTyped] = useState(share === null ? "" : String(share));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const custom = other || (share !== null && !PRESETS.includes(share));

  async function write(text: string) {
    if (base === null) return setProblem(t("settings.plan.needContribution"));
    const read = contributionOf({ cents: base, share: text });
    if (!read.ok) return setProblem(t(goalFieldErrorKey("reserveSharePercent", "invalid")));
    setSaving(true);
    const outcome = await save({ baseCents: read.baseCents, reserveSharePercent: read.reserveSharePercent });
    setSaving(false);
    setProblem(outcome.kind === "ok" ? null : t("settings.plan.failed"));
  }

  const label = t("settings.plan.share");
  return (
    <div className="flex flex-col gap-2">
      <span className="label">{label}</span>
      <SegmentedControl
        block
        label={label}
        value={custom ? OTHER : String(share)}
        onValueChange={(v) => {
          if (v === OTHER) return setOther(true);
          setOther(false);
          setTyped(v);
          void write(v);
        }}
        options={[...PRESETS.map((p) => ({ value: String(p), label: `${p}%` })), { value: OTHER, label: t("settings.plan.other") }]}
      />
      {custom && (
        <div className="flex items-end gap-2">
          <Input label={t("goals.contribution.share")} value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" autoComplete="off" disabled={saving} />
          <Button size="sm" loading={saving} onClick={() => void write(typed)}>
            {t("settings.income.save")}
          </Button>
        </div>
      )}
      {problem && <Banner tone="danger">{problem}</Banner>}
    </div>
  );
}
