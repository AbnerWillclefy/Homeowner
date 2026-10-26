import { useI18n } from "../../../shared/i18n";
import { demandLabel, labelText } from "../../profile/logic/labels";

/**
 * What the day holds, as the Check-in dialog's description: the planned Effort against today's Energy (only when
 * the Shell has a figure for it) and the saved one-day Restrictions, or that there are none. Plain text, with no
 * alarm colour when the plan is over Energy.
 */
export function CheckInDayLines({
  planned,
  restrictions,
}: {
  planned: { planned: number; energy: number } | null;
  restrictions: readonly string[];
}) {
  const { t } = useI18n();
  return (
    <>
      {planned && <p className="mt-2 mb-0 text-muted">{t("checkin.planned", planned)}</p>}
      <p className="mt-2 mb-0 text-muted [overflow-wrap:anywhere]">
        {restrictions.length > 0
          ? t("checkin.summary.restrictions", { demands: restrictions.map((id) => labelText(t, demandLabel(id))).join(", ") })
          : t("checkin.summary.restrictions.none")}
      </p>
    </>
  );
}
