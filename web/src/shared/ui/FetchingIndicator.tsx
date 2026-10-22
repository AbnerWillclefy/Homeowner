import { LoaderCircle } from "lucide-react";
import { useI18n } from "../i18n";
import { useDelayedFlag } from "./useDelayedFlag";

/**
 * A quiet sign that data already on screen is being refreshed. It waits the same 300ms as skeletons, so a fast
 * refetch never flickers. It has an accessible name but no live region, so screen readers do not announce every
 * refresh. The spinner is static with reduced motion, and currentColor keeps it visible in forced colours.
 */
export function FetchingIndicator({ active }: { active: boolean }) {
  const { t } = useI18n();
  const shown = useDelayedFlag(active);
  if (!shown) return null;
  return (
    <span role="img" aria-label={t("common.refreshing")} className="inline-flex">
      <LoaderCircle aria-hidden="true" size={16} className="text-muted motion-safe:animate-spin" />
    </span>
  );
}
