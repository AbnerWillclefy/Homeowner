import { StatCard } from "@homeowner/bedrock/finance";
import { Button, Card } from "@homeowner/bedrock";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/** The Daily allowance, or, without a Monthly income, a calm invitation to set one. */
export function Allowance({ cents, hasIncome }: { cents: number | undefined; hasIncome: boolean }) {
  const { t, locale } = useI18n();
  if (cents !== undefined) {
    return <StatCard label={t("overview.allowance.label")} cents={cents} locale={locale} hint={t(cents < 0 ? "overview.allowance.hintNegative" : "overview.allowance.hint")} />;
  }
  if (hasIncome) return null; // a past month: there are no days left to share the leftover over
  return (
    <Card className="items-start">
      <p>{t("overview.income.invite")}</p>
      <Button asChild variant="secondary">
        <Link to="/settings">{t("overview.income.set")}</Link>
      </Button>
    </Card>
  );
}
