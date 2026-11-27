import { Check, CircleX, Flame, Heart, Pause, type LucideIcon } from "lucide-react";
import { Badge } from "@homeowner/bedrock";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import type { Streak } from "../api/api";
import { weekBadges, weekdayShort, weekSummary } from "../logic/streakWeek";

const RULES = [
  { key: "streak.rule.grow", icon: Check, tile: "bg-brand-soft text-brand" },
  { key: "streak.rule.pause", icon: Pause, tile: "bg-surface-hover text-text-muted" },
  { key: "streak.rule.break", icon: CircleX, tile: "bg-surface-hover text-text-muted" },
  { key: "streak.rule.refuse", icon: Heart, tile: "bg-surface-hover text-text-muted" },
] as const satisfies readonly { key: MessageKey; icon: LucideIcon; tile: string }[];

/**
 * The body of the Streak Sheet: the flame tile with the current number, one line about today ("Hoje conta" when
 * today already grew it, the way to the next number when not, the empty line at 0), the last seven days when the
 * API gave them, and the four rules. Calm at every number (ADR 0003): a Streak of 0 is a quiet line, with no alarm
 * colour, alert or nudge; the only danger mark is a broken day in the strip, which is history. Presentational,
 * so it renders to static markup in tests.
 */
export function StreakDialog({ streak }: { streak: Streak }) {
  const { t, locale } = useI18n();
  const { current, week } = streak;
  const note = current === 0 ? t("streak.empty") : streak.todayGrew ? t("streak.todayCounts") : t("streak.next", { next: new Intl.NumberFormat(locale).format(current + 1) });
  const summary = week && weekSummary(week);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
          <Flame className="size-7" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="value-lg">{current === 0 ? t("streak.value.zero") : t("streak.value", { count: current })}</span>
          <span className="body text-text-muted">{note}</span>
        </div>
      </div>
      {week && summary && (
        <div role="group" aria-label={t(summary.open ? "streak.week.label.open" : "streak.week.label", { count: summary.count })} className="flex gap-1">
          {weekBadges(week).map(({ date, state, tone, icon }) => (
            <Badge key={date} tone={tone} icon={icon}>
              {state === "open" ? t("streak.week.today") : weekdayShort(date, locale)}
            </Badge>
          ))}
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {RULES.map(({ key, icon: Icon, tile }) => (
          <li key={key} className="body flex items-center gap-4">
            <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-md ${tile}`}>
              <Icon className="size-4" />
            </span>
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}
