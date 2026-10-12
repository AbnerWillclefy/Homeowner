import { useI18n } from "../i18n";
import { useHealth } from "../useHealth";
import { bannerFor } from "./bannerFor";

/** A slim banner with Retry, shown only when the API is unavailable or unreachable. */
export function HealthBanner() {
  const { t } = useI18n();
  const { state, retry } = useHealth();
  const key = bannerFor(state);
  if (key === null) return null;
  return (
    <div
      role="status"
      data-state={state.kind}
      className="my-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-raised px-3 py-1 text-sm"
    >
      <p className="my-1 min-w-0 flex-1">{t(key)}</p>
      <button type="button" className="btn my-1 me-0" onClick={retry}>
        {t("health.retry")}
      </button>
    </div>
  );
}
