import { Banner, Button, Sheet } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { SPENDING_CATEGORIES, spendingKey, type SpendingCategory } from "../logic/categories";
import { changedLimits, isValidLimit, type Limits } from "../logic/limit";

type Drafts = Partial<Record<SpendingCategory, number | null>>;

/**
 * Every Spending Category with its limit, to edit at once. Saving writes only the limits that changed, one idempotent
 * PUT each; one that fails goes back as it was, the sheet stays open, and saving again writes only what is still different.
 */
export function LimitsSheet({ limits, save, onClose }: { limits: Limits; save(category: SpendingCategory, cents: number | null): Promise<"saved" | "failed">; onClose(): void }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const [drafts, setDrafts] = useState<Drafts>(() => Object.fromEntries(SPENDING_CATEGORIES.map((c) => [c, limits[c] ?? null])));
  const [invalid, setInvalid] = useState<ReadonlySet<SpendingCategory>>(new Set());
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFailed(false);
    const bad = SPENDING_CATEGORIES.filter((c) => drafts[c] != null && !isValidLimit(drafts[c] ?? null));
    setInvalid(new Set(bad));
    if (bad.length > 0) return;
    setSaving(true);
    let allSaved = true;
    for (const { category, cents } of changedLimits(limits, drafts)) {
      if ((await save(category, cents)) === "failed") allSaved = false;
    }
    setSaving(false);
    if (allSaved) onClose();
    else setFailed(true);
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={t("categories.edit.title")}
      subtitle={t("categories.form.hint")}
      closeLabel={t("app.close")}
      footer={<Button type="submit" form={formId} loading={saving}>{t("categories.edit.save")}</Button>}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {SPENDING_CATEGORIES.map((c) => (
          <MoneyInput
            key={c}
            label={t("categories.edit.field", { name: t(spendingKey(c)) })}
            value={drafts[c] ?? null}
            onValueChange={(cents) => setDrafts((d) => ({ ...d, [c]: cents }))}
            error={invalid.has(c) ? t("categories.edit.invalid") : undefined}
            locale={locale}
          />
        ))}
        {failed && <Banner tone="danger">{t("categories.edit.failed")}</Banner>}
      </form>
    </Sheet>
  );
}
