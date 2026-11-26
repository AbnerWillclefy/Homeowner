import { Row } from "@homeowner/bedrock";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n";
import type { Resident } from "../api/api";
import { rowTarget } from "../logic/rowTarget";
import { Avatar } from "./Avatar";

/**
 * One Resident of the Home's list, as a Bedrock `Row`: Avatar, name, and a line with the current Streak and the Tasks
 * done today (cut to one line, as the design draws it; the Resident's page has them whole). The whole row is one link
 * and the touch target; the caller's own row carries a "You" tag. No colour or order marks anyone as ahead or behind.
 */
export function ResidentRow({ resident }: { resident: Resident }) {
  const { t } = useI18n();
  return (
    <Row
      asChild
      className="my-0"
      leading={<Avatar resident={resident} />}
      title={resident.name}
      caption={`${t("home.residents.streak", { count: resident.streak })} · ${t("home.residents.doneToday", { count: resident.doneToday })}`}
      trailing={
        <>
          {resident.you && (
            <span className="me-2 inline-flex items-center rounded-pill border border-border px-2 text-xs font-bold text-muted">
              {t("home.residents.you")}
            </span>
          )}
          <ChevronRight size={20} aria-hidden="true" className="text-muted" />
        </>
      }
    >
      <Link to={rowTarget(resident)} />
    </Row>
  );
}
