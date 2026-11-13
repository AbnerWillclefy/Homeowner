import { Badge, Banner, Button, Menu, SegmentedControl, type MenuItem } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Investment, Serves } from "../api";
import type { SaveOutcome } from "../hooks/useSavings";
import { groupInvestments } from "../logic/investments";

interface Props {
  investments: Investment[];
  pick(id: string, serves: Serves): Promise<SaveOutcome>;
  takeBankValue(id: string): Promise<SaveOutcome>;
  onAdd(): void;
  onEdit(investment: Investment): void;
  onDelete(investment: Investment): void;
}

/**
 * Investimentos, grouped by what they count toward. A bank one is marked, asks what it is for until picked (and
 * counts toward neither meanwhile), says "edited" with the bank's value beside it, and cannot be deleted.
 */
export function InvestmentsSection({ investments, pick, takeBankValue, onAdd, onEdit, onDelete }: Props) {
  const { t, locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const run = async (write: Promise<SaveOutcome>) => setFailed((await write).kind === "failed");
  return (
    <section aria-labelledby="investments-title" className="flex flex-col gap-3">
      <h2 id="investments-title" className="section-title">{t("investments.title")}</h2>
      <p className="caption text-text-muted">{t("investments.hint")}</p>
      {failed && <Banner tone="danger">{t("investments.failed")}</Banner>}
      {investments.length === 0 && <p className="body text-text-muted">{t("investments.empty")}</p>}
      {groupInvestments(investments).map((group) => (
        <div key={group.serves} className="flex flex-col">
          <h3 className="body-strong">{t(group.serves === "none" ? "investments.group.none" : group.serves === "reserve" ? "goals.reserve.title" : "goals.title")}</h3>
          <ul className="divide-y divide-border">
            {group.items.map((inv) => {
              const bank = inv.source === "pluggy";
              const items: MenuItem[] = [];
              if (!bank || inv.serves) items.push({ label: t("goals.edit"), icon: Pencil, onSelect: () => onEdit(inv) });
              if (!bank) items.push({ label: t("goals.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(inv) });
              return (
                <li key={inv.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <span className="body-strong [overflow-wrap:anywhere]">{inv.name}</span>
                      {(bank || inv.edited) && (
                        <span className="flex flex-wrap gap-1">
                          {bank && <Badge>{t("investments.fromBank")}</Badge>}
                          {inv.edited && <Badge tone="warning">{t("investments.edited")}</Badge>}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <Amount cents={inv.valueCents} size="sm" locale={locale} />
                      {inv.edited && inv.bankValueCents !== null && (
                        <span className="caption text-text-muted">{t("investments.bankValue", { amount: formatAmount(inv.bankValueCents, { locale }) })}</span>
                      )}
                    </div>
                  </div>
                  {bank && (
                    <>
                      {inv.serves === null && (
                        <>
                          <p className="body-strong">{t("investments.pick")}</p>
                          <p className="caption text-text-muted">{t("investments.pickNote")}</p>
                        </>
                      )}
                      <SegmentedControl
                        block
                        label={t("investments.servesLabel", { name: inv.name })}
                        value={inv.serves ?? ""}
                        onValueChange={(v) => void run(pick(inv.id, v as Serves))}
                        options={[{ value: "reserve", label: t("investments.serves.reserve") }, { value: "goals", label: t("investments.serves.goals") }]}
                      />
                      {!inv.reportedByBank && <p className="caption text-text-muted">{t("investments.gone")}</p>}
                    </>
                  )}
                  {(inv.edited || items.length > 0) && (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {inv.edited && (
                        <Button variant="secondary" size="sm" aria-label={t("investments.useBank.row", { name: inv.name })} onClick={() => void run(takeBankValue(inv.id))}>
                          {t("investments.useBank")}
                        </Button>
                      )}
                      {items.length > 0 && <Menu label={t("goals.menu", { name: inv.name })} closeLabel={t("app.close")} items={items} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Button variant="secondary" icon={Plus} className="self-start" onClick={onAdd}>
        {t("investments.add")}
      </Button>
    </section>
  );
}
