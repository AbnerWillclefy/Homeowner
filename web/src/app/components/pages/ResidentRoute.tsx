import { useParams } from "react-router";
import type { Home } from "../../../domains/home/api/api";
import { HomeGate } from "../../../domains/home/components/HomeGate";
import { BackToHome } from "../../../domains/residents/components/BackToHome";
import { ResidentPage } from "../../../domains/residents/components/ResidentPage";
import { ResidentPageSkeleton } from "../../../domains/residents/components/ResidentPageSkeleton";
import { useI18n } from "../../../shared/i18n";
import { PageLoading } from "../../../shared/ui/PageLoading";

/**
 * A housemate's page, nested under the Home tab. The back link is outside the Home gate so it is there while the
 * Home loads and when it fails. The id comes from the address; the route always has one.
 */
export default function ResidentRoute() {
  const { t } = useI18n();
  const { id } = useParams();
  if (id === undefined) return null;
  return (
    <PageLoading message={t("resident.loading")}>
      <BackToHome />
      <HomeGate skeleton={<ResidentPageSkeleton />}>{(current: Home) => <ResidentPage id={id} timeZone={current.timezone} />}</HomeGate>
    </PageLoading>
  );
}
