import { Banner, Button, Card, CardLabel, Input } from "@homeowner/bedrock";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { BillDaysResult, CardSource } from "../api";
import { readBillDays } from "../logic/billDays";

const FIELDS = ["closeDay", "dueDay"] as const;
type Problems = { closeDay?: string; dueDay?: string };

const problemKey = (field: (typeof FIELDS)[number], code: string): MessageKey =>
  code === "required" ? `cardBills.days.${field}.required` : `cardBills.days.${field}.invalid`;

/** "Datas do cartão": a card's closing and due days together, saved or cleared as a pair, never one. Key it by card so it starts from that card's days. */
export function BillDaysCard({ card, save }: { card: CardSource; save(closeDay: number | null, dueDay: number | null): Promise<BillDaysResult> }) {
  const { t } = useI18n();
  const [close, setClose] = useState(card.closeDay === null ? "" : String(card.closeDay));
  const [due, setDue] = useState(card.dueDay === null ? "" : String(card.dueDay));
  const [problems, setProblems] = useState<Problems>({});
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFailed(false);
    setSaved(false);
    const read = readBillDays(close, due);
    if (!read.ok) return setProblems(read.errors);
    setProblems({});
    setSaving(true);
    const result = await save(read.closeDay, read.dueDay);
    setSaving(false);
    if (result.kind === "ok") setSaved(true);
    else if (result.kind === "fields") setProblems(result.fields);
    else setFailed(true);
  }

  const values = { closeDay: [close, setClose], dueDay: [due, setDue] } as const;
  return (
    <Card>
      <CardLabel>{t("cardBills.days.heading")}</CardLabel>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((field) => (
            <Input
              key={field}
              label={t(`cardBills.days.${field}`)}
              value={values[field][0]}
              onChange={(e) => values[field][1](e.target.value)}
              error={problems[field] ? t(problemKey(field, problems[field])) : undefined}
              inputMode="numeric"
              autoComplete="off"
              disabled={saving}
            />
          ))}
        </div>
        <p className="caption text-text-muted">{t("cardBills.days.bank")} {t("cardBills.days.clear")}</p>
        {failed && <Banner tone="danger">{t("cardBills.days.failed")}</Banner>}
        {saved && <p role="status" className="caption text-text-muted">{t("cardBills.days.saved")}</p>}
        <div><Button type="submit" loading={saving}>{t("cardBills.days.save")}</Button></div>
      </form>
    </Card>
  );
}
