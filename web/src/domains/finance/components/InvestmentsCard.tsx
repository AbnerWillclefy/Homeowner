import { ChevronRight } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { RADIO_CARD } from "../../../shared/ui/radioCard";
import type { Investment, InvestmentInput, Serves } from "../api/api";
import type { SavingsOutcome } from "../hooks/useSavings";
import { centsToInput, formatCents } from "../logic/money";
import { groupInvestments, investmentInputOf } from "../logic/savings";
import { DeleteSavingsDialog } from "./DeleteSavingsDialog";
import { FinanceCard } from "./FinanceCard";
import { SavingsFormDialog } from "./SavingsFormDialog";

interface Props {
  investments: Investment[];
  save(id: string | null, input: InvestmentInput): Promise<SavingsOutcome>;
  remove(id: string): Promise<SavingsOutcome>;
}

/** Investimentos: typed by hand, grouped by what they serve, each opening its form. */
export function InvestmentsCard({ investments, save, remove }: Props) {
  const { t, locale } = useI18n();
  // `null` is a new Investment; the opener is the row or the Add button, where focus returns.
  const [editing, setEditing] = useState<{ investment: Investment | null } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = (investment: Investment | null, from: HTMLElement) => {
    opener.current = from;
    setEditing({ investment });
  };
  return (
    <FinanceCard id="finances-savings-investments" title={t("finances.savings.investments.title")} hint={t("finances.savings.investments.hint")}>
      {investments.length === 0 && <p className="my-0">{t("finances.savings.investments.empty")}</p>}
      {groupInvestments(investments).map((group) => (
        <div key={group.serves} className="flex flex-col">
          <h4 className="my-0 flex flex-wrap justify-between gap-x-3 text-base font-bold">
            <span>{t(group.serves === "reserve" ? "finances.savings.investments.reserve" : "finances.savings.investments.goals")}</span>
            <span className="[overflow-wrap:anywhere]">{formatCents(group.subtotalCents, locale)}</span>
          </h4>
          <ul className="m-0 flex list-none flex-col p-0">
            {group.items.map((investment) => (
              <li key={investment.id} className="m-0 border-t border-chart-track first:border-t-0">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 bg-transparent py-2 text-start text-text"
                  onClick={(event) => open(investment, event.currentTarget)}
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{investment.name}</span>
                  <span className="flex shrink-0 items-center gap-1 font-bold">
                    {formatCents(investment.valueCents, locale)}
                    <ChevronRight aria-hidden="true" size={16} className="rtl:rotate-180" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="my-0 text-sm text-muted">{t("finances.savings.investments.transferCard")}</p>
      <Button variant="secondary" className="self-start" onClick={(event) => open(null, event.currentTarget)}>
        {t("finances.savings.investments.add")}
      </Button>
      {editing && (
        <InvestmentDialog
          // A new key when another row opens, so the fields start from that row.
          key={editing.investment?.id ?? "new"}
          investment={editing.investment}
          save={save}
          remove={remove}
          returnFocusRef={opener}
          onClose={() => setEditing(null)}
        />
      )}
    </FinanceCard>
  );
}

function InvestmentDialog({
  investment,
  save,
  remove,
  returnFocusRef,
  onClose,
}: {
  investment: Investment | null;
  save: Props["save"];
  remove: Props["remove"];
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [serves, setServes] = useState<Serves>(investment?.serves ?? "reserve");
  return (
    <>
      <SavingsFormDialog
        title={t(investment ? "finances.savings.investments.editTitle" : "finances.savings.investments.addTitle")}
        returnFocusRef={returnFocusRef}
        onClose={onClose}
        below={
          investment && (
            <Button variant="danger" onClick={() => setDeleting(true)}>
              {t("finances.savings.investments.delete")}
            </Button>
          )
        }
        save={async (data) => {
          const result = investmentInputOf({ name: String(data.get("name") ?? ""), value: String(data.get("valueCents") ?? ""), serves }, locale);
          if (!result.ok) return { kind: "fields", fields: result.errors };
          return save(investment?.id ?? null, result.input);
        }}
      >
        {(field, saving) => (
          <>
            {field("name", t("finances.savings.investments.name"), (p) => (
              <input {...p} type="text" defaultValue={investment?.name ?? ""} autoComplete="off" maxLength={120} />
            ))}
            {field("valueCents", t("finances.savings.investments.value"), (p) => (
              <input {...p} type="text" inputMode="decimal" autoComplete="off" defaultValue={investment ? centsToInput(investment.valueCents, locale) : ""} />
            ))}
            <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving}>
              <legend className="p-0 font-semibold">{t("finances.savings.investments.serves")}</legend>
              <div className="mt-3 flex flex-col gap-2">
                {(["reserve", "goals"] as const).map((option) => (
                  <label key={option} className={RADIO_CARD}>
                    <input type="radio" name="serves" className="sr-only" checked={serves === option} onChange={() => setServes(option)} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{t(option === "reserve" ? "finances.savings.investments.servesReserve" : "finances.savings.investments.servesGoals")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="my-0 text-sm text-muted">{t("finances.savings.investments.transferForm")}</p>
          </>
        )}
      </SavingsFormDialog>
      {deleting && investment && (
        <DeleteSavingsDialog
          title={t("finances.savings.investments.deleteTitle")}
          body={t("finances.savings.investments.deleteBody", { name: investment.name })}
          action={t("finances.savings.investments.delete")}
          remove={async () => {
            const done = (await remove(investment.id)).kind === "ok";
            if (done) onClose();
            return done;
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}
