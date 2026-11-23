import { Banner, Button, Card } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Pencil, Plus } from "lucide-react";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ManualCard, Source } from "../api";
import { BankMark } from "./BankMark";
import { RenameSource } from "./RenameSource";
import { SourceRow } from "./SourceRow";

interface Props {
  sources: Source[];
  manualCards: ManualCard[];
  /** The manual cards could not be read: say so with Retry, not "none". */
  manualFailed: boolean;
  /** Maps a card's id (connected or manual) to the month's bill; empty while that read has not answered. */
  openBills: Map<string, number>;
  onAddManual(): void;
  onEditManual(card: ManualCard): void;
  onRetryManual(): void;
}

/** The credit cards, each connected one a link to Faturas with its limit, closing day and open bill, then the manual cards (the row opens their form); the foot adds a manual card. */
export function CardsCard({ sources, manualCards, manualFailed, openBills, onAddManual, onEditManual, onRetryManual }: Props) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const total = [...sources, ...manualCards].reduce((n, s) => n + (openBills.get(s.id) ?? 0), 0);
  return (
    <Card role="group" aria-labelledby="sources-cards">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sources-cards" className="card-label text-text-muted">{t("sources.group.cards")}</h2>
        {openBills.size > 0 && <Amount cents={total} size="sm" locale={locale} {...hidden} />}
      </div>
      <ul className="divide-y divide-border">
        {sources.map((source) => {
          const bill = openBills.get(source.id);
          const limit = source.creditLimitCents === undefined ? null : hidden.hidden ? t("sources.card.limit", { amount: hidden.hiddenLabel }) : t("sources.card.limit", { amount: formatAmount(source.creditLimitCents, { locale, precision: "whole" }) });
          const meta = [limit, source.closeDay !== null && t("sources.card.closes", { day: source.closeDay })].filter(Boolean).join(" · ");
          return (
            <li key={source.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SourceRow leading={<BankMark name={source.bankName} />} title={source.name} subtitle={meta || undefined} cents={bill} end={bill === undefined ? undefined : t("sources.card.openBill")}>
                  <Link to="/card-bills" />
                </SourceRow>
              </div>
              <RenameSource source={source} />
            </li>
          );
        })}
        {manualCards.map((card) => {
          const bill = openBills.get(card.id);
          return (
            <li key={card.id}>
              <SourceRow
                leading={<span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted"><Pencil className="size-4" /></span>}
                title={card.name}
                subtitle={t("sources.card.manualMeta", { day: card.dueDay })}
                cents={bill}
                end={bill === undefined ? undefined : t("sources.card.manualBill")}
              >
                <button type="button" aria-label={t("sources.card.manualEdit", { name: card.name })} onClick={() => onEditManual(card)} />
              </SourceRow>
            </li>
          );
        })}
      </ul>
      {manualFailed && (
        <Banner tone="danger">
          {t("sources.card.manualFailed")}{" "}
          <button type="button" className="underline" onClick={onRetryManual}>{t("sources.loadFailed.retry")}</button>
        </Banner>
      )}
      <Button variant="ghost" icon={Plus} className="w-full desktop:w-auto desktop:self-start" onClick={onAddManual}>
        {t("manualCard.add")}
      </Button>
    </Card>
  );
}
