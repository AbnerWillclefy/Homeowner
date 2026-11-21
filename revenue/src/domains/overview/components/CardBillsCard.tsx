import { Card } from "@homeowner/bedrock";
import { Amount, ListRow } from "@homeowner/bedrock/finance";
import { CreditCard } from "lucide-react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CommitmentMonth } from "../api/api";
import { formatDay } from "../logic/month";
import { CardHead } from "./CardHead";

/** The month's card bills and their total; closing and due dates only where the card's days are known. */
export function CardBillsCard({ data }: { data: CommitmentMonth }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const meta = (c: CommitmentMonth["cards"][number]) =>
    c.dueOn && c.closesOn
      ? t("overview.cards.meta", { closes: formatDay(c.closesOn, locale), due: formatDay(c.dueOn, locale) })
      : c.dueOn
        ? t("overview.cards.metaDue", { due: formatDay(c.dueOn, locale) })
        : undefined;
  return (
    <Card>
      <CardHead label={t("overview.cards.heading")} to="/card-bills" name={t("nav.cardBills")} />
      {data.cards.length === 0 ? (
        <p className="text-text-muted">{t("overview.cards.none")}</p>
      ) : (
        <>
          <Amount cents={data.cards.reduce((n, c) => n + c.amountCents, 0)} size="md" locale={locale} {...hidden} />
          <ul className="divide-y divide-border">
            {data.cards.map((c) => (
              <li key={c.sourceId}>
                <ListRow
                  leading={<span aria-hidden className="inline-flex size-8 items-center justify-center rounded-md bg-surface-sunken text-text-muted"><CreditCard className="size-4" /></span>}
                  title={c.name}
                  subtitle={meta(c)}
                  cents={c.amountCents}
                  locale={locale}
                  {...hidden}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
