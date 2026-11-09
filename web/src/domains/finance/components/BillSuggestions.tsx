import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import type { BillSuggestion } from "../api/api";
import { formatCents } from "../logic/money";

const MAX = 5;

/**
 * "Parece que se repete": up to five Bills the server noticed, offered rather than imposed. Adding opens the Bill form
 * prefilled; dismissing hides one for good, at once, and a failed dismissal brings it back with an error. Nothing shows
 * when there are none (or the read failed: an offer is not worth an alert).
 */
export function BillSuggestions({
  suggestions,
  onAdd,
  dismiss,
}: {
  suggestions: BillSuggestion[];
  onAdd(suggestion: BillSuggestion): void;
  dismiss(merchantKey: string): Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [failed, setFailed] = useState(false);

  async function onDismiss(merchantKey: string) {
    setFailed(false);
    if (!(await dismiss(merchantKey))) setFailed(true);
  }

  if (suggestions.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h4 id={id} className="my-0 text-base font-bold leading-snug">
          {t("finances.suggestions.heading")}
        </h4>
        <p className="my-0 text-muted">{t("finances.suggestions.question")}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {suggestions.slice(0, MAX).map((s) => (
          <li key={s.merchantKey} className="m-0 flex list-none flex-wrap items-center justify-between gap-2">
            <div className="min-w-32 flex-1">
              <p className="my-0 font-semibold [overflow-wrap:anywhere]">{s.name}</p>
              <p className="my-0 text-sm text-muted [overflow-wrap:anywhere]">
                {formatCents(s.amountCents, locale)} · {t("finances.suggestions.day", { n: s.dueDay })}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
              <Button aria-label={t("finances.suggestions.add.label", { name: s.name })} onClick={() => onAdd(s)}>
                {t("finances.suggestions.add")}
              </Button>
              <Button variant="secondary" aria-label={t("finances.suggestions.dismiss.label", { name: s.name })} onClick={() => void onDismiss(s.merchantKey)}>
                {t("finances.suggestions.dismiss")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <FormError form="finances-suggestions">{failed && t("finances.bills.failed")}</FormError>
    </Card>
  );
}
