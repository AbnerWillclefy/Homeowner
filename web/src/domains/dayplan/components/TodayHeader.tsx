import { useI18n } from "../../../shared/i18n";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { greetingKey } from "../logic/greeting";

/**
 * The top of Today: a time-of-day greeting from the device's clock (no name) and the date under it. Today's
 * Energy sits in the Check-in card below, next to the action that changes it.
 */
export function TodayHeader() {
  const { t, locale } = useI18n();
  const now = new Date();
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now);
  return <PageHeader title={t(greetingKey(now.getHours()))}>{date}</PageHeader>;
}
