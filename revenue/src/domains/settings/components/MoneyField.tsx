import { Banner, Button } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

type Props = {
  label: string;
  hint?: string;
  /** What the API holds (null when none). */
  saved: number | null;
  /** The problem text for a value that must not be sent, or null. */
  check(cents: number | null): string | null;
  /** Writes it; false when it failed. */
  save(cents: number | null): Promise<boolean>;
  /** Shows Clear next to Save while a value is held. */
  clearable?: boolean;
};

/** One setting that saves on its own: Save sends it, a failed save keeps what was typed and says so. */
export function MoneyField({ label, hint, saved, check, save, clearable }: Props) {
  const { t, locale } = useI18n();
  // Edits live here; until the first one the field shows what the API holds.
  const [edit, setEdit] = useState<{ cents: number | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "neutral" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const cents = edit ? edit.cents : saved;

  async function write(next: number | null) {
    setSaving(true);
    const ok = await save(next);
    setSaving(false);
    if (ok) setEdit(null);
    setMessage(ok ? { tone: "neutral", text: t("settings.plan.saved") } : { tone: "danger", text: t("settings.plan.failed") });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = check(cents);
    setProblem(found);
    if (!found) void write(cents);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <MoneyInput key={saved ?? "none"} label={label} hint={hint} value={cents} onValueChange={(c) => setEdit({ cents: c })} error={problem ?? undefined} locale={locale} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {t("settings.income.save")}
        </Button>
        {clearable && saved != null && (
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => void write(null)}>
            {t("settings.income.clear")}
          </Button>
        )}
      </div>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </form>
  );
}
