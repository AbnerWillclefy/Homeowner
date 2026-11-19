import { Badge, Button, Menu } from "@homeowner/bedrock";
import { CategoryIcon } from "@homeowner/bedrock/finance";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { PantryItem } from "../api";
import { daysBetween } from "../logic/pantry";

interface RowsProps {
  rows: PantryItem[];
  caption: string;
  /** `YYYY-MM-DD` in São Paulo, for "ran out 2 days ago". */
  today: string;
  /** Ids of the items whose write is pending; their button waits and their menu is off. */
  busy: ReadonlySet<string>;
  onRanOut(item: PantryItem): void;
  onOpen(item: PantryItem): void;
  onEdit(item: PantryItem): void;
  onDelete(item: PantryItem): void;
}

/** What a row says under its name: how long ago it ran out, the preferred brand, and the "always buy" mark. */
function useMeta() {
  const { t } = useI18n();
  return (item: PantryItem, today: string) => {
    const days = item.ranOutOn ? daysBetween(item.ranOutOn, today) : null;
    return [
      days === null ? null : days === 0 ? t("pantry.ranOutToday") : t(days === 1 ? "pantry.ranOutAgo.one" : "pantry.ranOutAgo.many", { count: days }),
      item.preferredBrand,
    ].filter(Boolean).join(" · ");
  };
}

/** One row per item; its name opens the detail. "Acabou" is a button on an item in stock, a badge on one that ran out; the menu has Edit and Delete. */
export function PantryRows({ rows, caption, today, busy, onRanOut, onOpen, onEdit, onDelete }: RowsProps) {
  const { t } = useI18n();
  const meta = useMeta();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((item) => {
        const line = meta(item, today);
        return (
          <li key={item.id} data-item={item.id} className="flex flex-wrap items-center gap-x-2">
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-4 py-2">
              <CategoryIcon category="groceries" />
              <span className="flex min-w-0 flex-1 flex-col">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-open
                  onClick={() => onOpen(item)}
                  className="body-strong min-h-11 rounded-sm text-left outline-none [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {item.name}
                </button>
                {line && <span className="caption text-text-muted [overflow-wrap:anywhere]">{line}</span>}
              </span>
              {item.fixed && (
                <Badge tone="brand" icon={Repeat}>{t("pantry.fixed")}</Badge>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {item.state === "ran_out" ? (
                <Badge tone="danger">{t("pantry.ranOut")}</Badge>
              ) : (
                <Button variant="secondary" size="sm" loading={busy.has(item.id)} onClick={() => onRanOut(item)}>
                  {t("pantry.ranOut")}<span className="sr-only">: {item.name}</span>
                </Button>
              )}
              <Menu
                label={t("pantry.menu", { name: item.name })}
                closeLabel={t("app.close")}
                items={[
                  { label: t("pantry.edit"), icon: Pencil, disabled: busy.has(item.id), onSelect: () => onEdit(item) },
                  { label: t("pantry.delete"), icon: Trash2, danger: true, disabled: busy.has(item.id), onSelect: () => onDelete(item) },
                ]}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
