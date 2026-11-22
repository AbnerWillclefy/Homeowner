import { Card, DescriptionList } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill } from "../../bills/api";

/** The month's Bills, which this screen's chart leaves out, and the way to the Bills screen. */
export function FixedBillsCard({ bills, search }: { bills: Bill[]; search: string }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  if (bills.length === 0) return null;
  return (
    <Card>
      <h2 className="section-title">{t("categories.fixed.title")}</h2>
      <DescriptionList items={bills.map((b) => ({ label: b.name, value: <Amount cents={b.expectedCents} size="sm" locale={locale} {...hidden} /> }))} />
      <Link to={{ pathname: "/bills", search }} className="body-strong inline-flex min-h-11 items-center rounded-sm underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {t("categories.fixed.open")}
      </Link>
    </Card>
  );
}
