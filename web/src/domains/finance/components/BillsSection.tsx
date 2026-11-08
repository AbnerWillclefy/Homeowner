import { Plus } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Bill } from "../api/api";
import { useBills } from "../hooks/useBills";
import { currentDay, currentMonth } from "../logic/month";
import { BillFormDialog } from "./BillFormDialog";
import { BillRow } from "./BillRow";
import { DeleteBillDialog } from "./DeleteBillDialog";

type Open = { kind: "form"; bill: Bill | null } | { kind: "delete"; bill: Bill } | null;

/** "Contas a pagar": this month's Bills, with add, edit, delete and the paid mark. */
export function BillsSection() {
  const { t } = useI18n();
  const [now] = useState(() => new Date());
  const month = currentMonth(now);
  const today = currentDay(now);
  const { state, refreshing, reload, save, remove, setPaid } = useBills(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function mark(bill: Bill, paid: boolean) {
    setBusy(bill.id);
    setFailed(false);
    if ((await setPaid(bill.id, paid)).kind !== "ok") setFailed(true);
    setBusy(null);
  }

  return (
    <section aria-labelledby="finances-bills-heading" className="mt-0 flex flex-col gap-3">
      <h3 id="finances-bills-heading" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.bills.heading")}
      </h3>
      {state.kind === "loading" && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {t("finances.bills.load.failed")}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {/* Mounted only on a failure, so the tab has no second empty alert beside the connect flow's own. */}
      {failed && <FormError form="finances-bills">{t("finances.bills.failed")}</FormError>}
      {state.kind === "ready" &&
        (state.data.length === 0 ? (
          <p className="my-0 text-muted">{t("finances.bills.empty")}</p>
        ) : (
          <ul className="m-0 flex flex-col gap-3 p-0">
            {state.data.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                today={today}
                busy={busy === bill.id}
                onPaid={(paid) => void mark(bill, paid)}
                onEdit={() => setOpen({ kind: "form", bill })}
                onDelete={() => setOpen({ kind: "delete", bill })}
              />
            ))}
          </ul>
        ))}
      {state.kind === "ready" && (
        <Button variant="secondary" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setOpen({ kind: "form", bill: null })}>
          {t("finances.bills.add")}
        </Button>
      )}
      {open?.kind === "form" && (
        <BillFormDialog bill={open.bill} save={(input) => save(open.bill?.id ?? null, input)} onClose={() => setOpen(null)} />
      )}
      {open?.kind === "delete" && <DeleteBillDialog bill={open.bill} remove={remove} onClose={() => setOpen(null)} />}
    </section>
  );
}
