import { Button, Card, CardLabel } from "@homeowner/bedrock";
import { CategoryIcon, ListRow } from "@homeowner/bedrock/finance";
import { X } from "lucide-react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BillSuggestion } from "../api";

const MAX = 5;

/**
 * Up to five Bills the server noticed in repeating charges, offered rather than imposed. Adding opens the form
 * prefilled; dismissing hides one at once and for good. Nothing shows when there are none.
 */
export function BillSuggestions({ suggestions, onAdd, onDismiss }: { suggestions: BillSuggestion[]; onAdd(s: BillSuggestion): void; onDismiss(s: BillSuggestion): void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  if (suggestions.length === 0) return null;
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <CardLabel>{t("bills.suggestions.heading")}</CardLabel>
        <p className="caption text-text-muted">{t("bills.suggestions.question")}</p>
      </div>
      <ul className="divide-y divide-border">
        {suggestions.slice(0, MAX).map((s) => (
          <li key={s.merchantKey} className="flex flex-wrap items-center justify-between gap-x-2">
            <ListRow
              className="w-auto min-w-0 flex-1 basis-48"
              leading={<CategoryIcon category="subscriptions" />}
              title={s.name}
              subtitle={t("bills.suggestions.day", { day: s.dueDay })}
              cents={s.amountCents}
              locale={locale}
              {...hidden}
            />
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="secondary" onClick={() => onAdd(s)}>
                {t("bills.suggestions.add")}<span className="sr-only">: {s.name}</span>
              </Button>
              <Button size="sm" variant="ghost" icon={X} onClick={() => onDismiss(s)}>
                <span className="sr-only">{t("bills.suggestions.dismiss")}: {s.name}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
