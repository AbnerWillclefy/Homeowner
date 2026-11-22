import { Badge, Banner, Button, Card, SegmentedControl } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Investment, Serves } from "../../goals/api";
import { useMoney } from "../../goals/hooks/useMoney";
import type { SaveOutcome } from "../../goals/hooks/useSavings";
import { groupInvestments } from "../../goals/logic/investments";
import { BankMark } from "./BankMark";
import { SourceRow } from "./SourceRow";

interface Props {
  investments: Investment[];
  pick(id: string, serves: Serves): Promise<SaveOutcome>;
  takeBankValue(id: string): Promise<SaveOutcome>;
  onAdd(): void;
  onEdit(investment: Investment): void;
}

/**
 * Investimentos, one single-line row each, ordered by what they count toward (reserve, goals, not picked). Tapping a row
 * opens its form; a bank one has the "Escolher" badge and a pick control until picked (it counts toward neither
 * meanwhile), says "edited" with the bank's value beside it, and cannot be deleted.
 */
export function InvestmentsSection({ investments, pick, takeBankValue, onAdd, onEdit }: Props) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const hidden = useHiddenProps();
  const [failed, setFailed] = useState(false);
  const run = async (write: Promise<SaveOutcome>) => setFailed((await write).kind === "failed");
  return (
    <Card role="group" aria-labelledby="investments-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="investments-title" className="card-label text-text-muted">{t("investments.title")}</h2>
        <Amount cents={investments.reduce((n, i) => n + i.valueCents, 0)} size="sm" locale={locale} {...hidden} />
      </div>
      {failed && <Banner tone="danger">{t("investments.failed")}</Banner>}
      {investments.length === 0 && <p className="body text-text-muted">{t("investments.empty")}</p>}
      <ul className="divide-y divide-border">
        {groupInvestments(investments).flatMap((g) => g.items).map((inv) => {
          const bank = inv.source === "pluggy";
          const editable = !bank || inv.serves !== null;
          const subtitle = [
            t(inv.serves === null ? "sources.investment.none" : inv.serves === "reserve" ? "goals.reserve.title" : "goals.title"),
            inv.edited && t("investments.edited"),
          ].filter(Boolean).join(" · ");
          const end = inv.serves === null
            ? <Badge tone="warning">{t("sources.investment.choose")}</Badge>
            : inv.edited && inv.bankValueCents !== null ? t("investments.bankValue", { amount: hidden.hidden ? hidden.hiddenLabel : money(inv.bankValueCents) }) : undefined;
          return (
            <li key={inv.id} className="flex flex-col">
              <SourceRow leading={<BankMark name={inv.name} />} title={inv.name} subtitle={subtitle} cents={inv.valueCents} end={end}>
                {editable ? <button type="button" aria-label={t("sources.investment.edit", { name: inv.name })} onClick={() => onEdit(inv)} /> : undefined}
              </SourceRow>
              {bank && (
                <div className="flex flex-col gap-2 pb-3">
                  {inv.serves === null && <p className="caption text-text-muted">{t("investments.pickNote")}</p>}
                  <SegmentedControl
                    block
                    label={t("investments.servesLabel", { name: inv.name })}
                    value={inv.serves ?? ""}
                    onValueChange={(v) => void run(pick(inv.id, v as Serves))}
                    options={[{ value: "reserve", label: t("investments.serves.reserve") }, { value: "goals", label: t("investments.serves.goals") }]}
                  />
                  {!inv.reportedByBank && <p className="caption text-text-muted">{t("investments.gone")}</p>}
                  {inv.edited && (
                    <Button variant="secondary" size="sm" className="self-end" aria-label={t("investments.useBank.row", { name: inv.name })} onClick={() => void run(takeBankValue(inv.id))}>
                      {t("investments.useBank")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="caption text-text-muted">{t("investments.hint")}</p>
      <Button variant="ghost" icon={Plus} className="w-full desktop:w-auto desktop:self-start" onClick={onAdd}>
        {t("investments.add")}
      </Button>
    </Card>
  );
}
