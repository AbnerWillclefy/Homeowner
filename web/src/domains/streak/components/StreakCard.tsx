import { Flame } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { CardRow } from "../../../shared/ui/CardRow";
import { IconTile } from "../../../shared/ui/IconTile";
import type { Streak } from "../api/api";

/**
 * The Resident's current Streak. Calm at every number: a Streak of 0 is a quiet invitation, never a failure
 * (ADR 0003), so there is no alarm colour. Shows nothing while loading or when the Streak could not be read.
 */
export function StreakCard({ streak }: { streak: Streak | null }) {
  const { t } = useI18n();
  if (!streak) return null;

  return (
    <CardRow
      as="section"
      aria-labelledby="streak-heading"
      glyph={<IconTile icon={Flame} className="bg-accent/10 text-accent" />}
    >
      <h3 id="streak-heading" className="my-0 text-sm font-normal text-muted">
        {t("streak.heading")}
      </h3>
      <p className="my-0 font-bold">{streak.current === 0 ? t("streak.empty") : t("streak.days", { count: streak.current })}</p>
      {streak.current > 0 && streak.todayGrew && <p className="my-0 text-sm text-muted">{t("streak.todayCounts")}</p>}
    </CardRow>
  );
}
