import { Banner, Button, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Landmark } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { SourceItem } from "./components/SourceItem";
import { useConnectBanks, useSources } from "./hooks/useSources";
import { FAILURE_KEY } from "./logic/failureMessages";
import { formatSyncTime } from "./logic/syncTime";

/** "Fontes" at `/sources`: connect banks through Pluggy Connect, and each Source with its name, balance and the day it was read. The saved credentials live in Settings. */
export function SourcesPage() {
  const { t, locale } = useI18n();
  const { data, loading, failed, reload } = useSources();
  const { connect, connecting, problem, closed } = useConnectBanks();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.sources")}</h1>
      <p className="text-text-muted">{t("sources.intro")}</p>

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("sources.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Landmark} kind="no-results" title={t("sources.loadFailed.title")} message={t("sources.loadFailed.message")} action={{ label: t("sources.loadFailed.retry"), onClick: reload }} />
      ) : (
        <>
          {data.sources.length === 0 ? (
            <EmptyState icon={Landmark} title={t("nav.sources")} message={t("sources.none")} />
          ) : (
            <section aria-labelledby="sources-list" className="flex flex-col gap-3">
              <h2 id="sources-list" className="section-title">{t("sources.list")}</h2>
              <ul className="flex list-none flex-col gap-4 p-0">
                {data.sources.map((source) => (
                  <li key={source.id}>
                    <SourceItem source={source} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* Always in the page, so a screen reader hears it appear. */}
          <p role="status" className="caption text-text-muted">
            {data.importing ? t("sources.importing") : data.lastSyncedAt && t("sources.lastSync", { when: formatSyncTime(data.lastSyncedAt, locale) })}
          </p>
        </>
      )}

      <div className="flex flex-col gap-3">
        <Button variant={data && data.sources.length > 0 ? "secondary" : "primary"} loading={connecting} onClick={() => void connect()}>
          {t("sources.connect")}
        </Button>
        {problem && (
          <Banner tone="danger">
            {t(FAILURE_KEY[problem])}
            {(problem === "no-credentials" || problem === "rejected") && (
              <>
                {" "}
                <Link to="/settings">{t("sources.settingsLink")}</Link>
              </>
            )}
          </Banner>
        )}
        {closed && <p role="status" className="text-text-muted">{t("sources.connect.closed")}</p>}
      </div>
    </section>
  );
}
