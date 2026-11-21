import { Badge } from "@homeowner/bedrock";
import { CalendarClock, Check, Clock, Landmark } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BillState } from "../logic/billState";

// Each state has its own word and icon shape. No state uses an alarm tone: overdue is said calmly, in words.
const STATUS = {
  "paid-hand": { icon: Check, tone: "positive", key: "bills.state.paid" },
  "paid-bank": { icon: Landmark, tone: "positive", key: "bills.state.paid" },
  due: { icon: Clock, tone: "neutral", key: "bills.state.due" },
  overdue: { icon: CalendarClock, tone: "neutral", key: "bills.state.overdue" },
} as const;

/** "Paga", "Pendente" or "Atrasada", with an icon, so colour is never the only signal. */
export function BillStatus({ state }: { state: BillState }) {
  const { t } = useI18n();
  const { icon, tone, key } = STATUS[state];
  return (
    <Badge icon={icon} tone={tone}>
      {t(key)}
    </Badge>
  );
}
