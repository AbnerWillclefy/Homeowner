import { Button } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useId } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BillSuggestion } from "../api";

const MAX = 5;

/**
 * Up to five Bills the server noticed in repeating charges, offered rather than imposed. Adding opens the form
 * prefilled; dismissing hides one at once and for good. Nothing shows when there are none.
 */
export function BillSuggestions({ suggestions, onAdd, onDismiss }: { suggestions: BillSuggestion[]; onAdd(s: BillSuggestion): void; onDismiss(s: BillSuggestion): void }) {
  const { t, locale } = useI18n();
  const id = useId();
  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
      <div>
        <h2 id={id} className="section-title">{t("bills.suggestions.heading")}</h2>
        <p className="body text-text-muted">{t("bills.suggestions.question")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {suggestions.slice(0, MAX).map((s) => (
          <li key={s.merchantKey} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-32 flex-1">
              <p className="body-strong [overflow-wrap:anywhere]">{s.name}</p>
              <p className="caption text-text-muted">{formatAmount(s.amountCents, { locale })} · {t("bills.suggestions.day", { day: s.dueDay })}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" onClick={() => onAdd(s)}>
                {t("bills.suggestions.add")}<span className="sr-only">: {s.name}</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onDismiss(s)}>
                {t("bills.suggestions.dismiss")}<span className="sr-only">: {s.name}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
