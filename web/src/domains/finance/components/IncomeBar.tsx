import { Link } from "react-router";
import { FINANCES_SETTINGS_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { formatCents } from "../logic/money";
import type { IncomeSplit } from "../logic/incomeSplit";
import { SplitBar } from "./charts/SplitBar";

/**
 * The Monthly income split in three: spent (solid), Bills still to pay (striped), what is left (the empty track).
 * Every amount is text. Over the income the "left" line says by how much in ordinary ink: no danger colour, no alert
 * icon, because the app states a fact and never raises an alarm.
 */
export function IncomeBar({ split }: { split: IncomeSplit | null }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatCents(cents, locale);
  return (
    <Card className="flex flex-col gap-3">
      {split ? (
        <>
          <SplitBar solid={split.spent} hatched={split.unpaid} max={split.scale} />
          <ul className="m-0 flex list-none flex-col gap-1 p-0 font-semibold">
            <li>{t("finances.summary.split.spent", { amount: money(split.spent) })}</li>
            <li>{t("finances.summary.split.unpaid", { amount: money(split.unpaid) })}</li>
            <li>{split.over > 0 ? t("finances.summary.split.over", { amount: money(split.over) }) : t("finances.summary.split.left", { amount: money(split.left) })}</li>
          </ul>
          <p className="my-0 text-sm text-muted">{t("finances.summary.split.hint")}</p>
        </>
      ) : (
        <p className="my-0">{t("finances.summary.split.none")}</p>
      )}
      <Button asChild variant="link" className="self-start">
        <Link to={FINANCES_SETTINGS_PATH}>{t(split ? "finances.commit.incomeChange" : "finances.commit.incomeSet")}</Link>
      </Button>
    </Card>
  );
}
