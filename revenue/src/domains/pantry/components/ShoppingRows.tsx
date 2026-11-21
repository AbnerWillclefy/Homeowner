import { Button, Checkbox, Dialog, Stepper } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ShoppingListItem } from "../api";
import { quantityLabel, stepFor } from "../logic/list";

interface RowsProps {
  rows: ShoppingListItem[];
  checked: ReadonlySet<string>;
  /** Ids whose write is pending; their stepper and remove button wait. */
  busy: ReadonlySet<string>;
  onCheck(id: string, on: boolean): void;
  onQuantity(id: string, quantityMilli: number): void;
  onRemove(id: string): void;
}

/** Removing is a server edit with no way back, so it asks first. Focus returns to the button when the question is cancelled. */
function RemoveButton({ item, busy, onRemove }: { item: ShoppingListItem; busy: boolean; onRemove(id: string): void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm" icon={Trash2} disabled={busy}>
          <span className="sr-only">{t("list.remove", { name: item.name })}</span>
        </Button>
      }
      title={t("list.remove.title")}
      description={t("list.remove.body", { name: item.name })}
      cancelLabel={t("pantry.form.cancel")}
      confirmLabel={t("list.remove.confirm")}
      onConfirm={() => onRemove(item.itemId)}
    />
  );
}

/** One row per line: check, name, quantity stepper, price and remove. A ticked row stays in place, struck through, so it can be unticked. */
export function ShoppingRows({ rows, checked, busy, onCheck, onQuantity, onRemove }: RowsProps) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  return (
    <ul aria-label={t("list.itemsCaption")} className="divide-y divide-border">
      {rows.map((item) => {
        const on = checked.has(item.itemId);
        const { step, min } = stepFor(item.unit);
        const kg = item.unit === "KG";
        const meta = [
          item.unitPriceCents === undefined ? t("list.noPrice") : kg ? `${money(item.unitPriceCents)}/kg` : t("list.each", { price: money(item.unitPriceCents) }),
          item.preferredBrand,
        ].filter(Boolean).join(" · ");
        return (
          <li key={item.itemId} data-item={item.itemId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 py-1">
            <Checkbox label={t("list.check", { name: item.name })} hideLabel checked={on} onCheckedChange={(v) => onCheck(item.itemId, v === true)} />
            <div className="flex min-w-0 flex-col gap-2 py-2">
              <span className={on ? "body-strong text-text-muted line-through [overflow-wrap:anywhere]" : "body-strong [overflow-wrap:anywhere]"}>{item.name}</span>
              <span className="caption text-text-muted [overflow-wrap:anywhere]">{meta}</span>
              <Stepper
                label={t("list.qty", { name: item.name })}
                decrementLabel={t("list.less")}
                incrementLabel={t("list.more")}
                value={item.quantityMilli / 1000}
                step={step / 1000}
                min={min / 1000}
                max={1000}
                format={() => quantityLabel(item.quantityMilli, item.unit, locale)}
                disabled={busy.has(item.itemId)}
                onValueChange={(v) => onQuantity(item.itemId, Math.round(v * 1000))}
              />
            </div>
            <div className="flex items-center gap-1 py-2">
              {item.priceCents === undefined ? (
                <span aria-hidden="true" className="value-sm text-text-muted">—</span>
              ) : (
                <Amount cents={item.priceCents} size="sm" locale={locale} className={on ? "text-text-muted line-through" : undefined} {...hiddenProps} />
              )}
              <RemoveButton item={item} busy={busy.has(item.itemId)} onRemove={onRemove} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
