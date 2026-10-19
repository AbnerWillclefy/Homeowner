import { CircleCheck, ChevronRight, Flame } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n";
import type { Resident } from "../api/api";
import { rowTarget } from "../logic/rowTarget";
import { Avatar } from "./Avatar";
import { ROW_PADDING } from "./rowLayout";

/**
 * One Resident in the Residents card: Avatar, name (with a "You" tag on the caller's own row), the current
 * Streak and the Tasks done today. The whole row is one link and the touch target. The name and the meta line
 * wrap and are never cut. No colour or order marks anyone as ahead or behind.
 */
export function ResidentRow({ resident }: { resident: Resident }) {
  const { t } = useI18n();
  return (
    <li className="border-t border-border/40 first:border-t-0">
      <Link to={rowTarget(resident)} className={`flex min-h-11 items-center gap-3 rounded-control text-inherit no-underline ${ROW_PADDING}`}>
        <Avatar resident={resident} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-h-6 flex-wrap items-center gap-x-2 font-bold [overflow-wrap:anywhere]">
            {resident.name}
            {resident.you && (
              <span className="inline-flex items-center rounded-pill border border-border px-2 text-xs font-bold text-muted">
                {t("home.residents.you")}
              </span>
            )}
          </span>
          <span className="flex min-h-5 flex-wrap gap-x-3 text-sm font-semibold text-muted">
            <span className="inline-flex items-center gap-1">
              <Flame aria-hidden="true" size={14} className="shrink-0" />
              {t("home.residents.streak", { count: resident.streak })}
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleCheck aria-hidden="true" size={14} className="shrink-0" />
              {t("home.residents.doneToday", { count: resident.doneToday })}
            </span>
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={20} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
