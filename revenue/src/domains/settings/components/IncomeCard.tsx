import { Banner, Button, Card } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useIncome } from "../hooks/useFinanceSettings";
import { readIncome } from "../logic/income";

/** Monthly income: it turns on the Daily allowance. Saving with the field set sends it; Clear removes it. */
export function IncomeCard() {
  const { t, locale } = useI18n();
  const { income, loading, failed, save } = useIncome();
  // Edits live here; until the first one the field shows what the API holds.
  const [edit, setEdit] = useState<{ cents: number | null } | null>(null);
  const [message, setMessage] = useState<{ tone: "neutral" | "danger"; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cents = edit ? edit.cents : (income ?? null);

  async function write(next: number | null, done: "settings.income.saved" | "settings.income.cleared") {
    setSaving(true);
    const ok = await save(next);
    setSaving(false);
    if (ok) setEdit(null);
    setMessage(ok ? { tone: "neutral", text: t(done) } : { tone: "danger", text: t("settings.income.failed") });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const read = readIncome(cents);
    if ("problem" in read) return setProblem(t(`settings.income.${read.problem}`));
    setProblem(null);
    void write(read.cents, "settings.income.saved");
  }

  return (
    <Card className="gap-4">
      <h2 className="section-title">{t("settings.income.title")}</h2>
      <p className="body text-text-muted">{t("settings.income.hint")}</p>
      {failed ? (
        <Banner tone="danger">{t("settings.income.loadFailed")}</Banner>
      ) : (
        !loading && (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <MoneyInput
              key={income ?? "none"}
              label={t("settings.income.field")}
              value={cents}
              onValueChange={(c) => setEdit({ cents: c })}
              error={problem ?? undefined}
              locale={locale}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving}>
                {t("settings.income.save")}
              </Button>
              {income != null && (
                <Button variant="secondary" disabled={saving} onClick={() => void write(null, "settings.income.cleared")}>
                  {t("settings.income.clear")}
                </Button>
              )}
            </div>
          </form>
        )
      )}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </Card>
  );
}
