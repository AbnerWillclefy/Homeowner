import { Banner, Button, Input, ProgressBar, SearchField } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import { getPantry, type MatchChoice } from "../api";
import { pantryKey } from "../hooks/usePantry";
import type { MatchOutcome } from "../hooks/useAddReceipt";
import { currentLine, quantityText, type Step } from "../logic/addReceipt";
import { pantryFieldErrorKey } from "../logic/fieldError";
import { itemFormOf } from "../logic/pantry";

type Matching = Extract<Step, { kind: "matching" }>;

// Without accents or case, so "cafe" finds "Café".
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** One unmatched line: pick an item, make a new one, or say it is not a pantry item. Each choice is written as it is made. */
export function MatchLine({ step, match, onBusy }: { step: Matching; match(receiptId: string, n: number, choice: MatchChoice): Promise<MatchOutcome>; onBusy(busy: boolean): void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const line = currentLine(step);
  const pantry = useQuery({ queryKey: pantryKey, queryFn: () => getPantry() });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const formId = useId();

  // The next line starts clean.
  useEffect(() => {
    setSearch("");
    setCreating(false);
    setName("");
    setBrand("");
    setErrors({});
    setFailed(false);
  }, [line?.n]);
  useEffect(() => {
    onBusy(saving);
    return () => onBusy(false);
  }, [saving, onBusy]);

  if (!line) return null;
  const position = step.total - step.queue.length + 1;
  const needle = plain(search);
  const items = (pantry.data ?? []).filter((i) => plain(`${i.name} ${i.preferredBrand ?? ""}`).includes(needle));

  async function choose(choice: MatchChoice): Promise<MatchOutcome> {
    setFailed(false);
    setSaving(true);
    const outcome = await match(step.receipt.id, line!.n, choice);
    setSaving(false);
    if (outcome.kind === "failed") setFailed(true);
    return outcome;
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const checked = itemFormOf({ name, brand });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    const outcome = await choose({ newItem: { name: checked.name, brand: checked.brand } });
    if (outcome.kind === "fields") setErrors(outcome.fields);
  }
  const fieldError = (field: string) => (errors[field] ? t(pantryFieldErrorKey(field, errors[field])) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar
        value={position - 1}
        max={step.total}
        tone="brand"
        label={t("receipt.progressLabel")}
        valueText={t("receipt.progress", { n: position, total: step.total })}
        start={<strong>{t("receipt.progress", { n: position, total: step.total })}</strong>}
        end={`${step.receipt.storeName} · ${formatDay(step.receipt.issuedOn, locale)}`}
      />
      <div className="flex items-center justify-between gap-4 rounded-md bg-surface-sunken p-4">
        <div className="min-w-0">
          <p className="body-strong break-words">{line.description}</p>
          <p className="caption text-text-muted">{quantityText(line, locale)}</p>
        </div>
        <Amount cents={line.totalCents} size="sm" locale={locale} {...hidden} />
      </div>

      {failed && <Banner tone="danger">{t("receipt.matchFailed")}</Banner>}

      {creating ? (
        <form id={formId} onSubmit={(e) => void create(e)} noValidate className="flex flex-col gap-4">
          <Input label={t("receipt.newName")} value={name} onChange={(e) => setName(e.target.value)} error={fieldError("name")} autoComplete="off" disabled={saving} />
          <Input label={t("receipt.newBrand")} hint={t("pantry.form.brandHint")} value={brand} onChange={(e) => setBrand(e.target.value)} error={fieldError("preferredBrand")} autoComplete="off" disabled={saving} />
          <Button type="submit" size="lg" loading={saving}>{t("receipt.newSave")}</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setCreating(false)}>{t("receipt.back")}</Button>
        </form>
      ) : (
        <>
          <p className="section-title">{t("receipt.pick")}</p>
          <SearchField label={t("receipt.search")} clearLabel={t("receipt.searchClear")} value={search} onValueChange={setSearch} placeholder={t("receipt.search")} />
          {items.length === 0 ? (
            <p className="body text-text-muted">{pantry.isPending ? "" : t("receipt.noMatch")}</p>
          ) : (
            <ul className="flex max-h-64 flex-col overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={t("receipt.pickAlt", { name: item.preferredBrand ? `${item.name}, ${item.preferredBrand}` : item.name })}
                    onClick={() => void choose({ itemId: item.id })}
                    className="flex min-h-12 w-full items-center justify-between gap-4 rounded-md px-2 text-left hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="min-w-0">
                      <span className="body-strong block break-words">{item.name}</span>
                      {item.preferredBrand && <span className="caption block text-text-muted">{item.preferredBrand}</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button size="lg" icon={Plus} disabled={saving} onClick={() => setCreating(true)}>{t("receipt.createNew")}</Button>
          <Button size="lg" variant="secondary" disabled={saving} onClick={() => void choose({ ignore: true })}>{t("receipt.notPantry")}</Button>
        </>
      )}
    </div>
  );
}
