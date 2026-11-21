import { Banner, Button, Input } from "@homeowner/bedrock";
import { useState, type FormEvent } from "react";
import { CenteredCard } from "../shared/CenteredCard";
import { useI18n } from "../shared/i18n/I18nProvider";
import { useAuth } from "./AuthContext";
import type { CognitoFailure } from "./cognito";

export function SignIn({ onForgot }: { onForgot: () => void }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<CognitoFailure | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailure(null);
    const result = await signIn(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
    setPending(false);
    // On success the session store changes and this screen is replaced.
    setFailure(result);
  }

  // Only the failures sign-in can end in have words; anything else is the generic one.
  const message = failure && (["not-authorized", "not-confirmed", "rate-limited", "network"].includes(failure.kind) ? failure.kind : "error");

  return (
    <CenteredCard title={t("signIn.title")}>
      <p className="body text-text-muted">{t("signIn.intro")}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {message && <Banner tone="danger">{t(`signIn.error.${message}` as "signIn.error.error")}</Banner>}
        <Input label={t("signIn.email")} name="email" type="email" autoComplete="username" required />
        <Input label={t("signIn.password")} name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" size="lg" loading={pending}>
          {pending ? t("signIn.submitting") : t("signIn.submit")}
        </Button>
      </form>
      <Button variant="ghost" onClick={onForgot}>
        {t("signIn.forgot")}
      </Button>
    </CenteredCard>
  );
}
