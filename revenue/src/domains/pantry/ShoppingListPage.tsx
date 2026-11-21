import { Banner, Button, Card, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Package, RefreshCw, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { ListSummary } from "./components/ListSummary";
import { ShoppingRows } from "./components/ShoppingRows";
import { useShoppingList } from "./hooks/useShoppingList";
import { readChecked, writeChecked } from "./logic/checked";
import { pruneChecked } from "./logic/list";

/**
 * "Lista de compras" at `/pantry/list`: what to buy next, with its expected total beside what is left of the groceries
 * limit. Quantities and removals are saved to the API; ticks stay on this device (`logic/checked.ts`) and never change the Pantry.
 */
export function ShoppingListPage() {
  const { t } = useI18n();
  const { data, loading, failed, reload, notice, busy, setQuantity, remove } = useShoppingList();
  const [ticks, setTicks] = useState(readChecked);

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
          <Button asChild variant="secondary">
            <Link to="/pantry"><Package className="size-4" aria-hidden />{t("nav.pantry")}</Link>
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
            {/* First on a phone, where the total is what the shopper checks; the list stays on the left from 1024px. */}
            <ListSummary list={data} className="desktop:order-2 desktop:col-span-4" />
            <Card className="desktop:order-1 desktop:col-span-8">
              <h2 className="section-title">{t("list.itemsHead")}</h2>
              <ShoppingRows rows={items} checked={new Set(ticks)} busy={busy} onCheck={check} onQuantity={setQuantity} onRemove={(id) => void remove(id)} />
            </Card>
          </>
        )}
      </div>
    </section>
  );
}
