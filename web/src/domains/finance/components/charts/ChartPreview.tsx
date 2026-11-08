import { useI18n } from "../../../../shared/i18n";
import { Card } from "../../../../shared/ui/Card";
import { scaleMax } from "../../logic/chart";
import { formatCents } from "../../logic/money";
import { Bar } from "./Bar";
import { CumulativeLine } from "./CumulativeLine";

// Sample cents, cumulative per day.
const THIS_MONTH = [0, 4500, 4500, 12000, 21000, 21000, 33500, 41000];
const LAST_MONTH = [2000, 2000, 9000, 15000, 15500, 30000, 36000, 41000, 52000, 52000, 60000, 71000];

/** Dev-only sample of the chart pieces, for screenshots and for looking at them on a phone. Deleted by #482. */
export function ChartPreview() {
  const { t, locale } = useI18n();
  const lastMarker = 41000;
  const max = scaleMax([52000, 98000, -4000], [lastMarker]);
  return (
    <Card as="section" aria-label={t("charts.preview.title")} className="mb-4 flex flex-col gap-4">
      <h3 className="m-0 text-base font-bold">{t("charts.preview.title")}</h3>
      <Bar label={t("charts.preview.groceries")} value={52000} max={max} />
      <Bar
        label={t("charts.preview.maintenance")}
        value={98000}
        max={max}
        variant="hatched"
        markers={[lastMarker]}
        note={t("finances.report.value", { month: t("charts.preview.lastMonth"), amount: formatCents(lastMarker, locale) })}
      />
      <Bar label={t("charts.preview.refund")} value={-4000} max={max} />
      <CumulativeLine
        title={t("charts.preview.cumulative")}
        series={[
          { label: t("charts.preview.thisMonth"), points: THIS_MONTH },
          { label: t("charts.preview.previous"), points: LAST_MONTH },
        ]}
      />
    </Card>
  );
}
