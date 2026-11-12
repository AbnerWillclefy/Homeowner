import { useState } from "react";
import { SegmentedControl } from "../../src";
import { Section } from "../Section";
import type { Locale } from "../App";

const text = {
  "pt-BR": {
    period: "Período",
    status: "Situação",
    periods: ["7d", "30d", "90d", "1a"],
    statuses: ["Todas", "Pagas", "Pendentes", "Atrasadas"],
  },
  en: {
    period: "Period",
    status: "Status",
    periods: ["7d", "30d", "90d", "1y"],
    statuses: ["All", "Paid", "Pending", "Late"],
  },
};

const withLabels = (values: string[], labels: string[]) => values.map((value, i) => ({ value, label: labels[i] }));

export default function SegmentedControlSection({ locale }: { locale: Locale }) {
  const t = text[locale];
  const [period, setPeriod] = useState("30d");
  const [status, setStatus] = useState("all");
  return (
    <Section name="SegmentedControl">
      <SegmentedControl label={t.period} value={period} onValueChange={setPeriod} options={withLabels(["7d", "30d", "90d", "1y"], t.periods)} />
      <SegmentedControl block label={t.status} value={status} onValueChange={setStatus} options={withLabels(["all", "paid", "pending", "late"], t.statuses)} />
    </Section>
  );
}
