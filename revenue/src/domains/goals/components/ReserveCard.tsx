import { Button, Card, CardContent, CardHeader, CardLabel, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount, MoneyInput } from "@homeowner/bedrock/finance";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Savings } from "../api";
import type { SaveOutcome } from "../hooks/useSavings";
import { progressPercent, reserveTargetOf, whenOf } from "../logic/savings";
import { MonthLine } from "./MonthLine";
import { SettingSheet } from "./SettingSheet";

type Write = (cents: number | null) => Promise<SaveOutcome>;

/** Reserva de emergência: the target, and how much of it the Investments marked for the reserve already cover. */
export function ReserveCard({ savings, save }: { savings: Savings; save: Write }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const target = savings.reserveTargetCents;
  const { savedCents: saved, monthCents } = savings.reserve;
  const money = (cents: number) => formatAmount(cents, { locale });
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardLabel>{t("goals.reserve.title")}</CardLabel>
      </CardHeader>
      {target !== null ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Amount cents={saved} size="lg" locale={locale} />
            <span className="caption text-text-muted">{t("goals.reserve.of", { amount: money(target) })}</span>
          </p>
          <ProgressBar
            tone="brand"
            value={saved}
            max={target}
            label={t("goals.reserve.progress")}
            valueText={t("goals.saved", { saved: money(saved), target: money(target) })}
            start={t("goals.saved", { saved: money(saved), target: money(target) })}
            end={t("goals.percent", { percent: progressPercent(saved, target) })}
          />
          <MonthLine monthCents={monthCents} when={whenOf({ ...savings.reserve, targetCents: target })} />
          <Button variant="secondary" icon={Pencil} className="self-start" onClick={() => setOpen(true)}>
            {t("goals.reserve.change")}
          </Button>
        </>
      ) : (
        <CardContent>
          <p className="body text-text-muted">{t("goals.reserve.empty")}</p>
          <Button className="self-start" onClick={() => setOpen(true)}>
            {t("goals.reserve.set")}
          </Button>
        </CardContent>
      )}
      {open && <ReserveSheet target={target} save={save} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function ReserveSheet({ target, save, onClose }: { target: number | null; save: Write; onClose(): void }) {
  const { t, locale } = useI18n();
  const [cents, setCents] = useState<number | null>(target);
  return (
    <SettingSheet
      title={t("goals.reserve.formTitle")}
      subtitle={t("goals.reserve.formIntro")}
      onClose={onClose}
      clear={target === null ? undefined : () => save(null)}
      submit={async () => {
        const result = reserveTargetOf(cents);
        return result.ok ? save(result.cents) : { kind: "fields", fields: result.errors };
      }}
    >
      {(error) => <MoneyInput label={t("goals.reserve.field")} value={cents} onValueChange={setCents} error={error("targetCents")} locale={locale} />}
    </SettingSheet>
  );
}
