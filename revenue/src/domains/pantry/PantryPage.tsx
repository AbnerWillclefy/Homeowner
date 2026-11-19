import { Badge, Banner, Button, Card, Dialog, EmptyState, Skeleton, Toast, ToastProvider } from "@homeowner/bedrock";
import { Package, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { saoPauloDay } from "../../shared/month/month";
import { PageHeader } from "../../shared/PageHeader";
import type { PantryItem } from "./api";
import { AddItemForm } from "./components/AddItemForm";
import { AddReceiptSheet } from "./components/AddReceiptSheet";
import { ItemDetailSheet } from "./components/ItemDetailSheet";
import { ItemSheet } from "./components/ItemSheet";
import { PantryRows } from "./components/PantryRows";
import { usePantry } from "./hooks/usePantry";
import { groupItems } from "./logic/pantry";

/**
 * "Despensa" at `/pantry`: what is at home and what ran out. One tap on "Acabou" moves the item at once and offers "Desfazer".
 * "Adicionar nota" opens the receipt Sheet; "Lista de compras" (an artboard tool) comes with the shopping list screen.
 */
export function PantryPage() {
  const { t } = useI18n();
  const { data, loading, failed, reload, refresh, notice, busy, setRanOut, add, update, remove } = usePantry();
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [deleting, setDeleting] = useState<PantryItem | null>(null);
  const [toast, setToast] = useState<PantryItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  // The row a Sheet opened from, and the button in it to hand focus back to: the menu for the edit Sheet, the name for the detail.
  const opener = useRef<{ id: string; button: string } | null>(null);

  useEffect(() => {
    if (editing || viewingId || !opener.current) return;
    const { id, button } = opener.current;
    document.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"] ${button}`)?.focus();
    opener.current = null;
  }, [editing, viewingId]);

  // A deleted item takes its Sheet with it; one deleted on another device is gone too, and the Pantry is read again.
  const closeGone = useCallback(() => { setViewingId(null); refresh(); }, [refresh]);

  const items = data ?? [];
  const viewing = items.find((i) => i.id === viewingId);
  const { out, stock } = groupItems(items);
  const today = saoPauloDay(new Date());
  const subtitle =
    data &&
    [
      t(items.length === 1 ? "pantry.count.one" : "pantry.count.many", { count: items.length }),
      ...(items.length === 0 ? [] : [t(out.length === 1 ? "pantry.outCount.one" : "pantry.outCount.many", { count: out.length })]),
    ].join(" · ");
  const ranOut = async (item: PantryItem) => {
    setToast(null);
    if (await setRanOut(item, true)) setToast(item);
  };
  const rows = (list: PantryItem[], caption: string) => (
    <PantryRows
      rows={list}
      caption={caption}
      today={today}
      busy={busy}
      onRanOut={(i) => void ranOut(i)}
      onOpen={(i) => { opener.current = { id: i.id, button: "[data-open]" }; setViewingId(i.id); }}
      onEdit={(i) => { opener.current = { id: i.id, button: ".ml-auto button:last-of-type" }; setEditing(i); }}
      onDelete={setDeleting}
    />
  );

  return (
    <ToastProvider label={t("pantry.toast.region")}>
      <section className="flex flex-col gap-6">
        <PageHeader title={t("nav.pantry")} subtitle={subtitle} tools={<AddReceiptSheet />} />

        {notice && <Banner tone="danger">{t(notice === "gone" ? "pantry.gone" : "pantry.failed")}</Banner>}

        <div className="grid gap-6 desktop:grid-cols-12">
          {loading ? (
            <>
              <Card aria-busy="true" aria-label={t("pantry.loading")} className="desktop:col-span-5">
                {[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </Card>
              <Card aria-busy="true" aria-label={t("pantry.loading")} className="desktop:col-span-7">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </Card>
            </>
          ) : failed || !data ? (
            <div className="desktop:col-span-12">
              <Banner tone="danger" action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={reload}>{t("pantry.error.retry")}</Button>}>
                {t("pantry.error")}
              </Banner>
            </div>
          ) : items.length === 0 ? (
            <Card className="desktop:col-span-12">
              <EmptyState icon={Package} title={t("pantry.empty.title")} message={t("pantry.empty.message")} />
              <div className="mx-auto w-full max-w-md">
                <AddItemForm add={add} />
              </div>
            </Card>
          ) : (
            <>
              <Card className="desktop:col-span-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-title">{t("pantry.outHead")}</h2>
                  <Badge tone="danger">{out.length}</Badge>
                </div>
                {out.length === 0 ? <p className="body text-text-muted">{t("pantry.out.none")}</p> : rows(out, t("pantry.outCaption"))}
              </Card>
              <Card className="desktop:col-span-7">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-title">{t("pantry.inHead")}</h2>
                  <Badge>{stock.length}</Badge>
                </div>
                <AddItemForm add={add} />
                {stock.length === 0 ? <p className="body text-text-muted">{t("pantry.stock.none")}</p> : rows(stock, t("pantry.inCaption"))}
              </Card>
            </>
          )}
        </div>

        {viewing && (
          <ItemDetailSheet
            key={viewing.id}
            item={viewing}
            busy={busy.has(viewing.id)}
            onRanOut={(i) => { setViewingId(null); void ranOut(i); }}
            onClose={() => setViewingId(null)}
            onGone={closeGone}
          />
        )}
        {editing && <ItemSheet key={editing.id} item={editing} save={(patch) => update(editing.id, patch)} onClose={() => setEditing(null)} />}
        {deleting && (
          <Dialog
            open
            onOpenChange={(open) => !open && setDeleting(null)}
            title={t("pantry.delete.title")}
            description={t("pantry.delete.body", { name: deleting.name })}
            cancelLabel={t("pantry.form.cancel")}
            confirmLabel={t("pantry.delete")}
            onConfirm={() => void remove(deleting.id)}
          />
        )}
        <Toast
          open={toast !== null}
          onOpenChange={(open) => !open && setToast(null)}
          tone="positive"
          title={t("pantry.toast.ranOut", { name: toast?.name ?? "" })}
          closeLabel={t("app.close")}
          action={toast ? { label: t("pantry.toast.undo"), altText: t("pantry.toast.undoAlt", { name: toast.name }), onClick: () => void setRanOut(toast, false) } : undefined}
        />
      </section>
    </ToastProvider>
  );
}
