import { Badge, Banner, Button, Card, Dialog, EmptyState, Skeleton, Toast, ToastProvider } from "@homeowner/bedrock";
import { Package, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { saoPauloDay } from "../../shared/month/month";
import { PageHeader } from "../../shared/PageHeader";
import type { PantryItem } from "./api";
import { AddItemForm } from "./components/AddItemForm";
import { ItemSheet } from "./components/ItemSheet";
import { PantryRows } from "./components/PantryRows";
import { usePantry } from "./hooks/usePantry";
import { groupItems } from "./logic/pantry";

/**
 * "Despensa" at `/pantry`: what is at home and what ran out. One tap on "Acabou" moves the item at once and offers "Desfazer".
 * "Adicionar nota" and "Lista de compras" (artboard tools) come with the receipt and shopping list screens.
 */
export function PantryPage() {
  const { t } = useI18n();
  const { data, loading, failed, reload, notice, busy, setRanOut, add, update, remove } = usePantry();
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [deleting, setDeleting] = useState<PantryItem | null>(null);
  const [toast, setToast] = useState<PantryItem | null>(null);
  const opener = useRef<string | null>(null);

  // A closed Sheet hands focus back to the row that opened it (its menu button is the row's last button).
  useEffect(() => {
    if (editing || !opener.current) return;
    document.querySelector<HTMLElement>(`[data-item="${CSS.escape(opener.current)}"] button:last-of-type`)?.focus();
    opener.current = null;
  }, [editing]);

  const items = data ?? [];
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
      onEdit={(i) => { opener.current = i.id; setEditing(i); }}
      onDelete={setDeleting}
    />
  );

  return (
    <ToastProvider label={t("pantry.toast.region")}>
      <section className="flex flex-col gap-6">
        <PageHeader title={t("nav.pantry")} subtitle={subtitle} />

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
