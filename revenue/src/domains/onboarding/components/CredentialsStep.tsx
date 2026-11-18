import { Banner, Button, Input } from "@homeowner/bedrock";
import { ExternalLink } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import { useCredentials } from "../../settings/hooks/useFinanceSettings";
import { StepActions, StepHeading } from "./StepFrame";

const MEUPLUGGY = "https://meu.pluggy.ai";
const FAILURE: Record<"invalid" | "rejected" | "error", MessageKey> = {
  invalid: "settings.creds.invalid",
  rejected: "settings.creds.rejected",
  error: "settings.creds.failed",
};

/** Step 1: why Revenue needs the User's own MeuPluggy credentials, and the form that saves them. Same write as Settings. */
export function CredentialsStep({ onNext, onSkip }: { onNext(): void; onSkip(): void }) {
  const { t } = useI18n();
  const { saved, loading, save } = useCredentials();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    // Read at submit and never kept in state, as in Settings.
    const result = await save(String(data.get("clientId") ?? "").trim(), String(data.get("clientSecret") ?? "").trim());
    setSaving(false);
    if (result === "ok") onNext();
    else setFailure(FAILURE[result]);
  }

  return (
    <>
      <StepHeading title={t("onboarding.creds.title")} why={t("onboarding.creds.why")} />
      {saved ? (
        <Banner tone="neutral">{t("onboarding.creds.saved")}</Banner>
      ) : (
        <form id="onboarding-creds" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <Input label={t("settings.creds.clientId")} name="clientId" type="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
          <Input label={t("settings.creds.clientSecret")} name="clientSecret" type="password" hint={t("onboarding.creds.secretHint")} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
          {failure && <Banner tone="danger">{t(failure)}</Banner>}
        </form>
      )}
      <a href={MEUPLUGGY} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 self-start text-brand underline">
        {t("onboarding.creds.help")}
        <ExternalLink aria-hidden className="size-4" />
      </a>
      <StepActions>
        <Button variant="ghost" onClick={onSkip}>{t("onboarding.skip")}</Button>
        {saved ? (
          <Button size="lg" onClick={onNext}>{t("onboarding.next")}</Button>
        ) : (
          <Button size="lg" type="submit" form="onboarding-creds" loading={saving} disabled={loading}>{t("onboarding.creds.save")}</Button>
        )}
      </StepActions>
    </>
  );
}
