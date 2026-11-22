import { Button, Input, SegmentedControl } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Investment, InvestmentInput, Serves } from "../../goals/api";
import type { SaveOutcome } from "../../goals/hooks/useSavings";
import { investmentInputOf } from "../../goals/logic/investments";
import { SettingSheet } from "../../goals/components/SettingSheet";

interface Props {
  /** null adds a hand-typed one. */
  investment: Investment | null;
  save(input: InvestmentInput): Promise<SaveOutcome>;
  /** Offered on a hand-typed one being edited; the page asks before deleting. */
  onDelete?(): void;
  onClose(): void;
}

/**
 * Adds a hand-typed Investment, or edits `investment`. A bank one only has its value corrected here: its name
 * comes from the bank and its pick is made on the row.
 * A hand-typed one can be deleted from here.
 */
export function InvestmentFormSheet({ investment, save, onDelete, onClose }: Props) {
  const { t, locale } = useI18n();
  const bank = investment?.source === "pluggy";
  const [name, setName] = useState(investment?.name ?? "");
  const [cents, setCents] = useState<number | null>(investment?.valueCents ?? null);
  const [serves, setServes] = useState<Serves | null>(investment?.serves ?? "reserve");
  return (
    <SettingSheet
      title={t(investment ? "investments.form.editTitle" : "investments.form.addTitle")}
      subtitle={bank ? investment.name : undefined}
      onClose={onClose}
      submit={async () => {
        // shortcut: the backend caps names at 60 and the sync doesn't, so a long bank name is saved cut short; upgrade with a value-only endpoint.
        const result = investmentInputOf({ name: bank ? [...name].slice(0, 60).join("") : name, cents, serves });
        return result.ok ? save(result.input) : { kind: "fields", fields: result.errors };
      }}
    >
      {(error, saving) => (
        <>
          {!bank && <Input label={t("investments.form.name")} value={name} onChange={(e) => setName(e.target.value)} error={error("name")} autoComplete="off" maxLength={120} disabled={saving} />}
          <MoneyInput label={t("investments.form.value")} hint={bank ? t("investments.form.valueBankHint") : undefined} value={cents} onValueChange={setCents} error={error("valueCents")} locale={locale} />
          {!bank && (
            <SegmentedControl
              block
              label={t("investments.form.serves")}
              value={serves ?? ""}
              onValueChange={(v) => setServes(v as Serves)}
              options={[{ value: "reserve", label: t("investments.serves.reserve") }, { value: "goals", label: t("investments.serves.goals") }]}
            />
          )}
          {investment && !bank && onDelete && <Button variant="ghost" className="self-start text-danger" disabled={saving} onClick={onDelete}>{t("goals.delete")}</Button>}
        </>
      )}
    </SettingSheet>
  );
}
