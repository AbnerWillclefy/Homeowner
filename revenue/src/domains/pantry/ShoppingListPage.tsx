import { Banner, Button, Card, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Package, RefreshCw, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { PageHeader } from "../../shared/PageHeader";
import { ListDock, ListSummary, OverWarning } from "./components/ListSummary";
import { QuantitySheet } from "./components/QuantitySheet";
import { ShoppingRows } from "./components/ShoppingRows";
import { useShoppingList } from "./hooks/useShoppingList";
import { readChecked, writeChecked } from "./logic/checked";
import { pruneChecked } from "./logic/list";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/**
 * "Lista de compras" at `/pantry/list`: what to buy next, with its expected total beside what is left of the groceries
 * limit: a card beside the items from 1024px, a dock above the BottomBar below it, where a button on each row opens the quantity Sheet.
 * Quantities and removals are saved to the API; ticks stay on this device (`logic/checked.ts`) and never change the Pantry.
 */
export function ShoppingListPage() {
  const { t } = useI18n();
  const { data, loading, failed, reload, notice, busy, setQuantity, remove } = useShoppingList();
  const [ticks, setTicks] = useState(readChecked);
  const desktop = useMediaQuery(DESKTOP);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The row's button that opened the Sheet, to hand focus back to (the Sheet has no trigger of its own).
  const opener = useRef<HTMLElement | null>(null);

  // A tick for an item that left the list is dropped, once no write is pending that could put the item back.
  useEffect(() => {
    if (!data || busy.size > 0) return;
    const kept = pruneChecked(ticks, data.items);
    if (kept.length !== ticks.length) {
      setTicks(kept);
      writeChecked(kept);
    }
  }, [data, busy, ticks]);

  const check = (id: string, on: boolean) => {
    const next = on ? [...ticks.filter((i) => i !== id), id] : ticks.filter((i) => i !== id);
    setTicks(next);
    writeChecked(next);
  };

  const items = data?.items ?? [];
  const editing = desktop ? undefined : items.find((i) => i.itemId === editingId);
  const edit = (id: string) => { opener.current = document.activeElement as HTMLElement | null; setEditingId(id); };
  const closeEdit = () => { setEditingId(null); setTimeout(() => opener.current?.focus()); };
  const count = items.length;
  const done = items.filter((i) => ticks.includes(i.itemId)).length;
  const subtitle =
    data &&
    [t(count === 1 ? "list.count.one" : "list.count.many", { count }), ...(count === 0 ? [] : [t(done === 1 ? "list.checked.one" : "list.checked.many", { count: done })])].join(" · ");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("pantry.list")}
        subtitle={subtitle}
        tools={
          <Button asChild variant="secondary" className="max-desktop:size-control-lg max-desktop:rounded-full max-desktop:px-0">
            <Link to="/pantry">
              <Package className="size-4" aria-hidden /><span className="max-desktop:sr-only">{t("nav.pantry")}</span>
            </Link>
          </Button>
        }
      />

      {notice && <Banner tone="danger">{t(notice === "gone" ? "list.gone" : "list.failed")}</Banner>}

      <div className="grid gap-6 desktop:grid-cols-12">
        {loading ? (
          <Card aria-busy="true" aria-label={t("list.loading")} className="desktop:col-span-12">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </Card>
        ) : failed || !data ? (
          <div className="desktop:col-span-12">
            <Banner tone="danger" action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={reload}>{t("list.error.retry")}</Button>}>
              {t("list.error")}
            </Banner>
          </div>
        ) : count === 0 ? (
          <Card className="desktop:col-span-12">
            <EmptyState icon={ShoppingCart} title={t("list.empty.title")} message={t("list.empty.message")} />
          </Card>
        ) : (
          <>
            {desktop ? <ListSummary list={data} className="desktop:order-2 desktop:col-span-4" /> : <OverWarning list={data} />}
            <Card variant={desktop ? "default" : "compact"} className="desktop:order-1 desktop:col-span-8">
              {desktop && <h2 className="section-title">{t("list.itemsHead")}</h2>}
              <ShoppingRows rows={items} checked={new Set(ticks)} busy={busy} desktop={desktop} onCheck={check} onEdit={edit} onQuantity={setQuantity} onRemove={(id) => void remove(id)} />
            </Card>
          </>
        )}
      </div>

      {!desktop && data && count > 0 && <ListDock list={data} />}
      {editing && <QuantitySheet item={editing} busy={busy.has(editing.itemId)} onQuantity={setQuantity} onRemove={(id) => void remove(id)} onClose={closeEdit} />}
    </section>
  );
}
