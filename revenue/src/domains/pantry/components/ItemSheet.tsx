import { Banner, Button, Checkbox, Input, Sheet } from "@homeowner/bedrock";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { PantryItem, PantryPatch } from "../api";
import type { SaveOutcome } from "../hooks/usePantry";
import { pantryFieldErrorKey } from "../logic/fieldError";
import { itemFormOf } from "../logic/pantry";

/**
 * Renames an item, sets its preferred brand and its "always buy" mark. It stays open until the write answers, shows
 * the reason inside itself and keeps what was typed when the write fails.
 */
export function ItemSheet({ item, save, onClose }: { item: PantryItem; save(patch: PantryPatch): Promise<SaveOutcome>; onClose(): void }) {
  const { t } = useI18n();
  const formId = useId();
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.preferredBrand ?? "");
  const [fixed, setFixed] = useState(item.fixed);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFailed(false);
    const checked = itemFormOf({ name, brand });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setSaving(true);
    const outcome = await save({ name: checked.name, preferredBrand: checked.brand, fixed });
    setSaving(false);
    if (outcome.kind === "ok") onClose();
    else if (outcome.kind === "fields") setErrors(outcome.fields);
    else setFailed(true);
  }

  const error = (field: string) => (errors[field] ? t(pantryFieldErrorKey(field, errors[field])) : undefined);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={t("pantry.form.editTitle")}
      subtitle={item.name}
      closeLabel={t("app.close")}
      footer={<Button type="submit" form={formId} loading={saving}>{t("pantry.form.save")}</Button>}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <Input label={t("pantry.form.name")} value={name} onChange={(e) => setName(e.target.value)} error={error("name")} autoComplete="off" disabled={saving} />
        <Input label={t("pantry.form.brand")} hint={t("pantry.form.brandHint")} value={brand} onChange={(e) => setBrand(e.target.value)} error={error("preferredBrand")} autoComplete="off" disabled={saving} />
        <Checkbox label={t("pantry.always")} checked={fixed} onCheckedChange={(v) => setFixed(v === true)} disabled={saving} />
        {failed && <Banner tone="danger">{t("pantry.failed")}</Banner>}
      </form>
    </Sheet>
  );
}
