import { useI18n } from "../../../shared/i18n";
import { StatTile } from "../../../shared/ui/StatTile";
import type { ResidentDetail } from "../api/api";
import { Avatar } from "./Avatar";
import { HEADER_COLUMN, NAME_HEIGHT, STAT_GRID } from "./pageLayout";

/**
 * Who this is and two plain numbers: their current Streak and how many Tasks they completed in the last 7 days.
 * The name is the page's h2, where focus lands. Zeros read in the same voice as any other number, and nothing
 * here compares one Resident with another.
 */
export function ResidentHeader({ resident }: { resident: ResidentDetail }) {
  const { t } = useI18n();
  return (
    <>
      <div className={HEADER_COLUMN}>
        <Avatar size="lg" resident={resident} />
        <h2 className={`mt-1 mb-0 text-3xl leading-tight font-bold [overflow-wrap:anywhere] ${NAME_HEIGHT}`}>{resident.name}</h2>
      </div>
      <div className={STAT_GRID}>
        <StatTile value={resident.streak} label={t("resident.streak", { count: resident.streak })} />
        <StatTile value={resident.doneLast7Days} label={t("resident.done7", { count: resident.doneLast7Days })} />
      </div>
    </>
  );
}
