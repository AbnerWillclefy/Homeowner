import { useRef, useState, type RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import type { Savings } from "../api/api";
import { centsToInput, formatCents } from "../logic/money";
import { reserveTargetOf } from "../logic/savings";
import { progressPercent, whenOf } from "../logic/suggestion";
import { Track } from "./charts/Bar";
import { FinanceCard } from "./FinanceCard";
import { MonthLine } from "./MonthLine";
import { SavingsFormDialog } from "./SavingsFormDialog";

type Write = (cents: number | null) => Promise<boolean>;

/** Reserva de emergência: the target, and how much of it the Investments marked for the reserve already cover. */
export function ReserveCard({ savings, save }: { savings: Savings; save: Write }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const target = savings.reserveTargetCents;
  const { savedCents: saved, monthCents } = savings.reserve;
  const percent = target === null ? 0 : progressPercent(saved, target);
  return (
    <FinanceCard id="finances-savings-reserve" title={t("finances.savings.reserve.title")}>
      {target !== null ? (
        <>
          <p className="my-0">
            <span className="text-3xl font-bold [overflow-wrap:anywhere]">{formatCents(saved, locale)}</span>{" "}
            <span className="text-muted">{t("finances.savings.reserve.of", { amount: formatCents(target, locale) })}</span>
          </p>
          {/* The saved amount, the target and the percentage are text above and below: the bar only draws them. */}
          <Track value={saved} max={target} />
          <p className="my-0 text-sm text-muted">{t("finances.savings.reserve.percent", { percent })}</p>
          <MonthLine monthCents={monthCents} when={whenOf({ ...savings.reserve, targetCents: target })} who="reserve" />
          <Button ref={opener} variant="link" className="self-end text-sm" onClick={() => setOpen(true)}>
            {t("finances.savings.reserve.change")}
          </Button>
        </>
      ) : (
        <>
          <p className="my-0">{t("finances.savings.reserve.empty")}</p>
          <Button ref={opener} className="self-start" onClick={() => setOpen(true)}>
            {t("finances.savings.reserve.set")}
          </Button>
        </>
      )}
      {open && <ReserveDialog target={target} save={save} returnFocusRef={opener} onClose={() => setOpen(false)} />}
    </FinanceCard>
  );
}

function ReserveDialog({ target, save, returnFocusRef, onClose }: { target: number | null; save: Write; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void }) {
  const { t, locale } = useI18n();
  return (
    <SavingsFormDialog
      title={t("finances.savings.reserve.formTitle")}
      intro={t("finances.savings.reserve.formIntro")}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      clear={target === null ? undefined : () => save(null)}
      save={async (data) => {
        const result = reserveTargetOf(String(data.get("targetCents") ?? ""), locale);
        if (!result.ok) return { kind: "fields", fields: result.errors };
        return (await save(result.cents)) ? { kind: "ok" } : { kind: "failed" };
      }}
    >
      {(field) =>
        field("targetCents", t("finances.savings.reserve.field"), (p) => (
          <input {...p} type="text" inputMode="decimal" autoComplete="off" defaultValue={target === null ? "" : centsToInput(target, locale)} />
        ))
      }
    </SavingsFormDialog>
  );
}
