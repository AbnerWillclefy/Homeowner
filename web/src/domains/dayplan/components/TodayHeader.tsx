import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { greetingKey } from "../logic/greeting";

/**
 * The top of Today: a time-of-day greeting from the device's clock and the date under it. The greeting names the
 * Resident once `GET /me` has answered; until then (and if it fails) it is the plain greeting, so Today never
 * waits on the name. A long name wraps and is never cut. Today's Energy sits in the Check-in card below, next to
 * the action that changes it.
 */
export function TodayHeader() {
  const { t, locale } = useI18n();
  const { me } = useShell();
  const now = new Date();
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now);
  const name = me.state.kind === "ready" ? me.state.me.name : null;
  const title = name === null ? t(greetingKey(now.getHours())) : t(greetingKey(now.getHours(), true), { name });
  return <PageHeader title={<span className="[overflow-wrap:anywhere]">{title}</span>}>{date}</PageHeader>;
}
