import { Button, Checkbox, Dialog, Stepper } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Pencil, Trash2 } from "lucide-react";
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
  /** From 1024px the stepper and the remove button sit in the row; below it a button opens the quantity Sheet instead. */
  desktop: boolean;
  onCheck(id: string, on: boolean): void;
  /** Opens the quantity Sheet (phone). */
  onEdit(id: string): void;
  onQuantity(id: string, quantityMilli: number): void;
  onRemove(id: string): void;
}

/**
 * Removing is a server edit with no way back, so it asks first. Focus returns to the button when the question is cancelled.
 * With `label` it is a full-width text button (inside the quantity Sheet); without, an icon button named for screen readers.
 */
export function RemoveButton({ item, busy, onRemove, label }: { item: ShoppingListItem; busy: boolean; onRemove(id: string): void; label?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        label ? (
          <Button variant="ghost" size="lg" icon={Trash2} disabled={busy} className="w-full">{label}</Button>
        ) : (
          <Button variant="ghost" size="sm" icon={Trash2} disabled={busy}>
            <span className="sr-only">{t("list.remove", { name: item.name })}</span>
          </Button>
        )
      }
      title={t("list.remove.title")}
      description={t("list.remove.body", { name: item.name })}
      cancelLabel={t("pantry.form.cancel")}
      confirmLabel={t("list.remove.confirm")}
      onConfirm={() => onRemove(item.itemId)}
    />
  );
}

/**
 * One row per line. Desktop: check, name, quantity stepper, price and remove. Phone: check, name with "quantity × price",
 * the line price and a button for the quantity Sheet, so a row stays one line. A ticked row stays in place, struck through, so it can be unticked.
 */
export function ShoppingRows({ rows, checked, busy, desktop, onCheck, onEdit, onQuantity, onRemove }: RowsProps) {
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
        const unitPrice = item.unitPriceCents === undefined ? t("list.noPrice") : kg ? `${money(item.unitPriceCents)}/kg` : money(item.unitPriceCents);
        const meta = [item.unitPriceCents === undefined || kg ? unitPrice : t("list.each", { price: unitPrice }), item.preferredBrand].filter(Boolean).join(" · ");
        const phoneMeta = `${quantityLabel(item.quantityMilli, item.unit, locale)} × ${unitPrice}`;
        const price =
          item.priceCents === undefined ? (
            <span aria-hidden="true" className="value-sm text-text-muted">—</span>
          ) : (
            <Amount cents={item.priceCents} size="sm" locale={locale} className={on ? "text-text-muted line-through" : undefined} {...hiddenProps} />
          );
        const name = <span className={on ? "body-strong truncate text-text-muted line-through" : "body-strong truncate"}>{item.name}</span>;
        const check = <Checkbox label={t("list.check", { name: item.name })} hideLabel checked={on} onCheckedChange={(v) => onCheck(item.itemId, v === true)} />;
        return desktop ? (
          <li key={item.itemId} data-item={item.itemId} className="grid grid-cols-[auto_minmax(0,1fr)_auto_7rem_auto] items-center gap-x-4 py-2">
            {check}
            <div className="flex min-w-0 flex-col">
              {name}
              <span className="caption truncate text-text-muted">{meta}</span>
            </div>
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
            <span className="text-right">{price}</span>
            <RemoveButton item={item} busy={busy.has(item.itemId)} onRemove={onRemove} />
          </li>
        ) : (
          <li key={item.itemId} data-item={item.itemId} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 py-1">
            {/* Pulls the checkbox's 48px hit area to the card's edge, as the artboard's `.rv-phone .br-listrow > .br-checkbox` does. */}
            <span className="-ml-2">{check}</span>
            <div className="flex min-w-0 flex-col py-2">
              {name}
              <span className="caption truncate text-text-muted">{phoneMeta}</span>
            </div>
            {price}
            <Button variant="ghost" size="sm" icon={Pencil} disabled={busy.has(item.itemId)} onClick={() => onEdit(item.itemId)} className="size-control-lg rounded-full px-0">
              <span className="sr-only">{t("list.editQty", { name: item.name })}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
