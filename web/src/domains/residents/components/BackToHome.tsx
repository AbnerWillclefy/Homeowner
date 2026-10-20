import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { HOME_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";

/** The way back to Your Home. It renders at once on the Resident page, in every state, so there is always a way out. */
export function BackToHome() {
  const { t } = useI18n();
  return (
    <div className="mb-2 flex justify-start">
      <Button asChild variant="link">
        <Link to={HOME_PATH}>
          <ChevronLeft aria-hidden="true" size={18} className="shrink-0" />
          {t("resident.back")}
        </Link>
      </Button>
    </div>
  );
}
