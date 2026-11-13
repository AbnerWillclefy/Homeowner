import { Banner, Button } from "@homeowner/bedrock";
import { formatAmount, MoneyInput } from "@homeowner/bedrock/finance";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { isValidLimit } from "../logic/limit";

/** Sets or removes the monthly limit of one category. The bar above changes at once; a line confirms, and a failed write is said here. */
export function LimitForm({ limit, onSave }: { limit: number | undefined; onSave(cents: number | null): Promise<"saved" | "failed"> }) {
  const { t, locale } = useI18n();
  // Typed text stays after a failed write, next to the message, so it can be tried again.
  const [cents, setCents] = useState<number | null>(limit ?? null);
  const [problem, setProblem] = useState<"invalid" | "failed" | null>(null);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function write(to: number | null) {
    setProblem(null);
    setDone("");
    setBusy(true);
    const outcome = await onSave(to);
    setBusy(false);
    if (outcome === "failed") return setProblem("failed");
    if (to === null) setCents(null);
    setDone(to === null ? t("categories.form.removed") : t("categories.form.saved", { amount: formatAmount(to, { locale }) }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!isValidLimit(cents)) return setProblem("invalid");
    void write(cents);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <MoneyInput label={t("categories.form.label")} hint={t("categories.form.hint")} value={cents} onValueChange={setCents} locale={locale} error={problem === "invalid" ? t("categories.form.invalid") : undefined} />
      {problem === "failed" && <Banner tone="danger">{t("categories.form.failed")}</Banner>}
      <p role="status" className="caption text-text-muted">{done}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>{t("categories.form.save")}</Button>
        {limit !== undefined && <Button variant="secondary" disabled={busy} onClick={() => void write(null)}>{t("categories.form.remove")}</Button>}
      </div>
    </form>
  );
}
