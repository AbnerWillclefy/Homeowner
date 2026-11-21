import { Banner, Button, Card } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Pencil, Plus } from "lucide-react";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ManualCard, Source } from "../api";
import { BankMark } from "./BankMark";
import { RenameSource } from "./RenameSource";

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

/** The credit cards, each connected one a link to Faturas with its limit, closing day and open bill, then the manual cards with an edit button; the foot adds a manual card. */
export function CardsCard({ sources, manualCards, manualFailed, openBills, onAddManual, onEditManual, onRetryManual }: Props) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const total = [...sources, ...manualCards].reduce((n, s) => n + (openBills.get(s.id) ?? 0), 0);
  return (
    <Card role="group" aria-labelledby="sources-cards">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sources-cards" className="card-label text-text-muted">{t("sources.group.cards")}</h2>
        {openBills.size > 0 && <Amount cents={total} size="md" locale={locale} {...hidden} />}
      </div>
      <ul className="divide-y divide-border">
        {sources.map((source) => {
          const bill = openBills.get(source.id);
          const limit = source.creditLimitCents === undefined ? null : hidden.hidden ? t("sources.card.limit", { amount: hidden.hiddenLabel }) : t("sources.card.limit", { amount: formatAmount(source.creditLimitCents, { locale, precision: "whole" }) });
          const meta = [limit, source.closeDay !== null && t("sources.card.closes", { day: source.closeDay })].filter(Boolean).join(" · ");
          return (
            <li key={source.id} className="flex items-center gap-2">
              <Link
                to="/card-bills"
                className="flex min-h-control-lg min-w-0 flex-1 items-center gap-3 rounded-md py-2 outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <BankMark name={source.bankName} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="body-strong [overflow-wrap:anywhere]">{source.name}</span>
                  {meta && <span className="caption text-text-muted">{meta}</span>}
                </span>
                {bill !== undefined && (
                  <span className="flex shrink-0 flex-col items-end">
                    <Amount cents={bill} size="sm" locale={locale} {...hidden} />
                    <span className="caption text-text-muted">{t("sources.card.openBill")}</span>
                  </span>
                )}
              </Link>
              <RenameSource source={source} />
            </li>
          );
        })}
        {manualCards.map((card) => {
          const bill = openBills.get(card.id);
          return (
            <li key={card.id} className="flex items-center gap-2">
              <div className="flex min-h-control-lg min-w-0 flex-1 items-center gap-3 py-2">
                <BankMark name={card.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="body-strong [overflow-wrap:anywhere]">{card.name}</span>
                  <span className="caption text-text-muted">{t("sources.card.manualMeta", { day: card.dueDay })}</span>
                </span>
                {bill !== undefined && (
                  <span className="flex shrink-0 flex-col items-end">
                    <Amount cents={bill} size="sm" locale={locale} {...hidden} />
                    <span className="caption text-text-muted">{t("sources.card.manualBill")}</span>
                  </span>
                )}
              </div>
              <Button variant="ghost" icon={Pencil} onClick={() => onEditManual(card)}>
                <span className="sr-only">{t("sources.card.manualEdit", { name: card.name })}</span>
              </Button>
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
      <Button variant="ghost" icon={Plus} className="self-start" onClick={onAddManual}>
        {t("manualCard.add")}
      </Button>
    </Card>
  );
}
