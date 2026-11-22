import { DescriptionList, Sheet, Stepper } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ShoppingListItem } from "../api";
import { quantityLabel, stepFor } from "../logic/list";
import { RemoveButton } from "./ShoppingRows";

interface Props {
  item: ShoppingListItem;
  busy: boolean;
  onQuantity(id: string, quantityMilli: number): void;
  onRemove(id: string): void;
  onClose(): void;
}

/** The phone's way to change a line: its quantity with the stepper, the line total it makes, and taking it off the list. */
export function QuantitySheet({ item, busy, onQuantity, onRemove, onClose }: Props) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const { step, min } = stepFor(item.unit);
  const kg = item.unit === "KG";
  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  const subtitle =
    item.unitPriceCents === undefined ? t("list.noPrice") : kg ? `${money(item.unitPriceCents)}/kg` : t("list.each", { price: money(item.unitPriceCents) });
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={item.name} subtitle={subtitle} closeLabel={t("app.close")}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          <span className="body-strong">{t("list.quantity")}</span>
          <Stepper
            label={t("list.qty", { name: item.name })}
            decrementLabel={t("list.less")}
            incrementLabel={t("list.more")}
            value={item.quantityMilli / 1000}
            step={step / 1000}
            min={min / 1000}
            max={1000}
            format={() => quantityLabel(item.quantityMilli, item.unit, locale)}
            disabled={busy}
            onValueChange={(v) => onQuantity(item.itemId, Math.round(v * 1000))}
          />
        </div>
        <DescriptionList
          items={[{ label: t("list.lineTotal"), total: true, value: item.priceCents === undefined ? <span aria-hidden="true">—</span> : <Amount cents={item.priceCents} size="sm" locale={locale} {...hiddenProps} /> }]}
        />
        <RemoveButton item={item} busy={busy} label={t("list.takeOff")} onRemove={(id) => { onClose(); onRemove(id); }} />
      </div>
    </Sheet>
  );
}
