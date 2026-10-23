import { useI18n } from "../../../shared/i18n";
import { StatTile } from "../../../shared/ui/StatTile";
import type { Streak } from "../api/api";

const RULES = ["streak.rule.grow", "streak.rule.pause", "streak.rule.break", "streak.rule.refuse"] as const;

/**
 * The body of the Streak dialog: the current number, "Today counts" when today already grew it (or the empty line at
 * 0), and the four rules. Calm at every number (ADR 0003): a Streak of 0 is a quiet line, with no alarm colour,
 * alert or nudge. Presentational, so it renders to static markup in tests.
 */
export function StreakDialog({ streak }: { streak: Streak }) {
  const { t, locale } = useI18n();
  const { current } = streak;
  const value = new Intl.NumberFormat(locale).format(current);
  const label = current === 0 ? t("streak.stat.zero") : t("streak.stat", { count: current });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <StatTile value={value} label={label} />
      {current === 0 ? (
        <p className="my-0 text-sm text-muted">{t("streak.empty")}</p>
      ) : (
        streak.todayGrew && <p className="my-0 text-sm text-muted">{t("streak.todayCounts")}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {RULES.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </div>
  );
}
