import { Badge, Banner, Button, Card } from "@homeowner/bedrock";
import { Check, ChevronLeft, Plus, TriangleAlert } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useConnectBanks, useSources } from "../../sources/hooks/useSources";
import { FAILURE_KEY } from "../../sources/logic/failureMessages";
import { StepActions, StepHeading } from "./StepFrame";

/** Step 2: connect banks with Sources' own flow. A 409 or a refused credential sends the User back to step 1. */
export function BanksStep({ onBack, onNext, onSkip, onCredentials }: { onBack(): void; onNext(): void; onSkip(): void; onCredentials(): void }) {
  const { t } = useI18n();
  const { data } = useSources();
  const { connect, connecting, problem, closed } = useConnectBanks();
  const items = data?.items ?? [];
  const credentialsProblem = problem === "no-credentials" || problem === "rejected";

  return (
    <>
      <StepHeading title={t("onboarding.banks.title")} why={t("onboarding.banks.why")} />
      <Card className="gap-4">
        {items.length === 0 ? (
          <p className="body text-text-muted">{t("onboarding.banks.none")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="body-strong">{item.bankName ?? t("onboarding.banks.unnamed")}</span>
                {item.status === "ok" ? (
                  <Badge tone="positive" icon={Check}>{t("onboarding.banks.ok")}</Badge>
                ) : (
                  <Badge tone="warning" icon={TriangleAlert}>{t("onboarding.banks.reconnect")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" icon={Plus} loading={connecting} onClick={() => void connect()}>
          {t(items.length === 0 ? "onboarding.banks.connect" : "onboarding.banks.connectAnother")}
        </Button>
      </Card>
      {/* Always in the page, so a screen reader hears it appear. */}
      <p role="status" className="caption text-text-muted">{data?.importing ? t("sources.importing") : closed ? t("sources.connect.closed") : ""}</p>
      {problem && (
        <Banner tone="danger">
          {t(credentialsProblem ? "onboarding.banks.needCreds" : FAILURE_KEY[problem])}
          {credentialsProblem && (
            <>
              {" "}
              <Button size="sm" variant="secondary" onClick={onCredentials}>{t("onboarding.banks.toCreds")}</Button>
            </>
          )}
        </Banner>
      )}
      <StepActions back={<Button variant="ghost" icon={ChevronLeft} onClick={onBack}>{t("onboarding.back")}</Button>}>
        <Button variant="ghost" onClick={onSkip}>{t("onboarding.skip")}</Button>
        <Button size="lg" onClick={onNext}>{t("onboarding.next")}</Button>
      </StepActions>
    </>
  );
}
