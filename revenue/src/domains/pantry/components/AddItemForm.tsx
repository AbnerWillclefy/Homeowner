import { Button, Input } from "@homeowner/bedrock";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { SaveOutcome } from "../hooks/usePantry";
import { pantryFieldErrorKey } from "../logic/fieldError";
import { itemFormOf } from "../logic/pantry";

/** The add-by-name field. It clears on success and keeps what was typed, with the reason, when the item is refused. */
export function AddItemForm({ add }: { add(name: string): Promise<SaveOutcome> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const checked = itemFormOf({ name, brand: "" });
    if (!checked.ok) return setCode(checked.errors.name ?? null);
    setCode(null);
    setSaving(true);
    const outcome = await add(checked.name);
    setSaving(false);
    if (outcome.kind === "ok") setName("");
    else setCode(outcome.kind === "fields" ? (outcome.fields.name ?? "unknown") : "failed");
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label={t("pantry.add.label")} className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <Input
          label={t("pantry.add.label")}
          placeholder={t("pantry.add.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={code === null ? undefined : code === "failed" ? t("pantry.failed") : t(pantryFieldErrorKey("name", code))}
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="secondary" icon={Plus} loading={saving} className="mt-6">
        {t("pantry.add.submit")}
      </Button>
    </form>
  );
}
