import { Button, SearchField, SegmentedControl, Select, Sheet } from "@homeowner/bedrock";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { TYPES } from "../api";
import { SPENDING_CATEGORIES, spendingKey } from "../logic/categories";
import type { Filter } from "../logic/filter";

interface ToolbarProps {
  filter: Filter;
  onChange(filter: Filter): void;
  desktop: boolean;
  uncategorised: number;
}

/** The filters the segment cannot reach: every type (Transfer and Saving too) and the Spending Category. */
function FiltersButton({ filter, onChange }: Pick<ToolbarProps, "filter" | "onChange">) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const active = filter.category !== "all" || filter.type === "transfer" || filter.type === "saving";
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t("tx.filters.title")}
      closeLabel={t("app.close")}
      trigger={
        <Button variant={active ? "primary" : "secondary"} icon={SlidersHorizontal} className="w-control-md shrink-0 px-0 max-tablet:w-control-lg">
          <span className="sr-only">{t(active ? "tx.filters.openActive" : "tx.filters.open")}</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <Select
          label={t("tx.filter.type")}
          value={filter.type}
          onValueChange={(v) => onChange({ ...filter, type: v as Filter["type"], uncategorised: false })}
          options={[{ value: "all", label: t("tx.filters.allTypes") }, ...TYPES.map((v) => ({ value: v, label: t(`tx.type.${v}`) }))]}
        />
        <Select
          label={t("tx.filter.category")}
          value={filter.category}
          onValueChange={(v) => onChange({ ...filter, category: v as Filter["category"], uncategorised: false })}
          options={[{ value: "all", label: t("tx.filter.allCategories") }, ...SPENDING_CATEGORIES.map((id) => ({ value: id, label: t(spendingKey(id)) }))]}
        />
      </div>
    </Sheet>
  );
}

/** Search and the type filter: a segment on a desktop width, chips on a phone (with "Sem categoria" among them). */
export function Toolbar({ filter, onChange, desktop, uncategorised }: ToolbarProps) {
  const { t } = useI18n();
  const types = [
    { value: "all", label: t("tx.seg.all") },
    { value: "expense", label: t("tx.seg.expense") },
    { value: "income", label: t("tx.seg.income") },
  ];
  const search = (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <div className="min-w-0 flex-1">
        <SearchField
          label={t("tx.search.label")}
          clearLabel={t("tx.search.clear")}
          placeholder={t("tx.search.placeholder")}
          value={filter.query}
          onValueChange={(query) => onChange({ ...filter, query })}
        />
      </div>
      <FiltersButton filter={filter} onChange={onChange} />
    </div>
  );
  if (desktop) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        {search}
        <SegmentedControl label={t("tx.filter.type")} options={types} value={filter.type} onValueChange={(type) => onChange({ ...filter, type: type as Filter["type"], uncategorised: false })} />
      </div>
    );
  }
  const chips = [
    ...types.map((o) => ({ ...o, pressed: !filter.uncategorised && filter.type === o.value, set: { type: o.value as Filter["type"], uncategorised: false } })),
    { value: "uncategorised", label: t("tx.chip.uncategorised", { n: uncategorised }), pressed: filter.uncategorised, set: filter.uncategorised ? { uncategorised: false } : { uncategorised: true, type: "all" as const, category: "all" as const } },
  ];
  return (
    <div className="flex flex-col gap-2">
      {search}
      <div role="group" aria-label={t("tx.filter.type")} className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <Button key={chip.value} size="sm" className="shrink-0" variant={chip.pressed ? "primary" : "secondary"} aria-pressed={chip.pressed} onClick={() => onChange({ ...filter, ...chip.set })}>
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
