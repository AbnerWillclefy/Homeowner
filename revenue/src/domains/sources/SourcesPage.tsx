import { Banner, Button, Card, Dialog, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Landmark, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { HideValuesToggle } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { timeAgo } from "../../shared/timeAgo";
import type { Investment } from "../goals/api";
import { InvestmentFormSheet } from "../goals/components/InvestmentFormSheet";
import { InvestmentsSection } from "../goals/components/InvestmentsSection";
import { useSavings } from "../goals/hooks/useSavings";
import { Block } from "../overview/components/Block";
import { useCommitments } from "../overview/hooks/useOverviewData";
import { AccountsCard } from "./components/AccountsCard";
import { BanksCard } from "./components/BanksCard";
import { CardsCard } from "./components/CardsCard";
import { useConnectBanks, useSources } from "./hooks/useSources";
import { FAILURE_KEY } from "./logic/failureMessages";

/**
 * "Fontes" at `/sources` on the 12-column grid: the accounts, the Investments and the credit cards on the left; the connected
 * banks and the read-only note on the right. Connect banks through Pluggy Connect; the saved credentials live in Settings.
 */
export function SourcesPage() {
  const { t, locale } = useI18n();
  const { thisMonth } = useMonthParam();
  const { data, loading, failed, reload } = useSources();
  const { connect, connecting, problem, closed } = useConnectBanks();
  const savings = useSavings();
  const commitments = useCommitments(thisMonth);
  const [now] = useState(() => new Date());
  const [form, setForm] = useState<{ investment: Investment | null } | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  // The same read the overview's card bills use, so the cache is shared; a card without a bill there simply shows none.
  const openBills = useMemo(() => new Map((commitments.data?.month.cards ?? []).map((c) => [c.sourceId, c.amountCents])), [commitments.data]);
  const accounts = data?.sources.filter((s) => s.kind !== "credit_card") ?? [];
  const cards = data?.sources.filter((s) => s.kind === "credit_card") ?? [];
  const subtitle = data
    ? [
        data.items.length > 0 && t(data.items.length === 1 ? "sources.subtitle.banks.one" : "sources.subtitle.banks.other", { n: data.items.length }),
        data.lastSyncedAt && t("sources.subtitle.updated", { when: timeAgo(data.lastSyncedAt, now, locale) }),
      ].filter(Boolean).join(" · ")
    : undefined;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.sources")}
        subtitle={subtitle}
        tools={
          <>
            <HideValuesToggle />
            <Button loading={connecting} onClick={() => void connect()}>{t("sources.connect")}</Button>
          </>
        }
      />

      {/* Always in the page, so a screen reader hears it appear. */}
      <p role="status" className="caption text-text-muted">{data?.importing ? t("sources.importing") : closed ? t("sources.connect.closed") : ""}</p>
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
      {deleteFailed && <Banner tone="danger">{t("investments.failed")}</Banner>}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("sources.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Landmark} kind="no-results" title={t("sources.loadFailed.title")} message={t("sources.loadFailed.message")} action={{ label: t("sources.loadFailed.retry"), onClick: reload }} />
      ) : (
        <div className="grid gap-6 desktop:grid-cols-12">
          <div className="flex flex-col gap-6 desktop:col-span-8">
            {data.sources.length === 0 && <EmptyState icon={Landmark} title={t("nav.sources")} message={t("sources.none")} />}
            {accounts.length > 0 && <AccountsCard sources={accounts} />}
            <Block label={t("investments.title")} failed={t("sources.failed.investments")} state={savings}>
              {(s) => (
                <InvestmentsSection
                  investments={s.investments}
                  pick={savings.pickServes}
                  takeBankValue={savings.takeBankValue}
                  onAdd={() => setForm({ investment: null })}
                  onEdit={(investment) => setForm({ investment })}
                  onDelete={(investment) => { setDeleteFailed(false); setDeleting(investment); }}
                />
              )}
            </Block>
            {cards.length > 0 && <CardsCard sources={cards} openBills={openBills} />}
          </div>
          <div className="flex flex-col gap-6 desktop:col-span-4">
            {data.items.length > 0 && <BanksCard items={data.items} />}
            <Card>
              <div className="flex items-start gap-2">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-text-muted" />
                <p className="text-text-muted">{t("sources.readOnly")}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {form && <InvestmentFormSheet key={form.investment?.id ?? "new"} investment={form.investment} save={(input) => savings.saveInvestment(form.investment?.id ?? null, input)} onClose={() => setForm(null)} />}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("investments.delete.title")}
          description={t("investments.delete.body", { name: deleting.name })}
          cancelLabel={t("goals.form.cancel")}
          confirmLabel={t("goals.delete")}
          onConfirm={() => void savings.removeInvestment(deleting.id).then((r) => setDeleteFailed(r.kind === "failed"))}
        />
      )}
    </section>
  );
}
