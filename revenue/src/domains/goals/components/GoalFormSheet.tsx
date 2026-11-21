import { Button, Input } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { GoalInput, SavingsGoal } from "../api";
import type { SaveOutcome } from "../hooks/useSavings";
import { goalInputOf } from "../logic/savings";
import { SettingSheet } from "./SettingSheet";

/** Adds a Goal, or edits `goal`. The date is optional: only a Goal with a set date is served first. */
export function GoalFormSheet({ goal, save, onClose }: { goal: SavingsGoal | null; save(input: GoalInput): Promise<SaveOutcome>; onClose(): void }) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(goal?.name ?? "");
  const [cents, setCents] = useState<number | null>(goal?.targetCents ?? null);
  const [month, setMonth] = useState(goal?.targetMonth ?? "");
  return (
    <SettingSheet
      title={t(goal ? "goals.form.editTitle" : "goals.form.addTitle")}
      onClose={onClose}
      submit={async () => {
        const result = goalInputOf({ name, cents, month });
        return result.ok ? save(result.input) : { kind: "fields", fields: result.errors };
      }}
    >
      {(error, saving) => (
        <>
          <Input label={t("goals.form.name")} value={name} onChange={(e) => setName(e.target.value)} error={error("name")} autoComplete="off" maxLength={120} disabled={saving} />
          <MoneyInput label={t("goals.form.target")} value={cents} onValueChange={setCents} error={error("targetCents")} locale={locale} />
          {/* A month input where the browser has one; elsewhere it is a text field and `MM/YYYY` or `YYYY-MM` is read. */}
          <Input label={t("goals.form.month")} hint={t("goals.form.monthHint")} type="month" value={month} onChange={(e) => setMonth(e.target.value)} error={error("targetMonth")} disabled={saving} />
          {month !== "" && (
            <Button variant="ghost" className="self-start" onClick={() => setMonth("")}>
              {t("goals.form.noDate")}
            </Button>
          )}
        </>
      )}
    </SettingSheet>
  );
}
