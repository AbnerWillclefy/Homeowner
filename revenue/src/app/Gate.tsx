import { Banner, Button } from "@homeowner/bedrock";
import { useEffect, type ReactNode } from "react";
import { useFinanceMe } from "../api/financeMe";
import { useAuth } from "../auth/AuthContext";
import { CenteredCard } from "../shared/CenteredCard";
import { useI18n } from "../shared/i18n/I18nProvider";

/**
 * Renders its children only when `GET /me/finance` answers 200. This gate is a convenience: it saves a User off
 * the allowlist from a screen full of failing requests. The API's 403 on every `/me/finance` route is the control.
 * Until the answer is 200, no child is mounted, so no other query fires.
 */
export function Gate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const me = useFinanceMe();
  const { signOut } = useAuth();
  const unauthorized = me.data?.kind === "unauthorized";

  // A 401 means the session is no good: end it, and the app shows sign-in.
  useEffect(() => {
    if (unauthorized) signOut();
  }, [unauthorized, signOut]);

  if (me.isPending) return <p role="status" className="p-6 body text-text-muted">{t("gate.checking")}</p>;

  // No answer yet because the request failed (503 "finance not configured", network): offer a retry. A failed
  // refetch after an answer keeps that answer, so one blip does not unmount the app.
  if (me.data === undefined) {
    return (
      <CenteredCard title={t("gate.error.title")}>
        <Banner tone="danger">{t("gate.error.message")}</Banner>
        <Button onClick={() => void me.refetch()} loading={me.isFetching}>
          {t("gate.error.retry")}
        </Button>
        <Button variant="secondary" onClick={signOut}>
          {t("prefs.signOut")}
        </Button>
      </CenteredCard>
    );
  }

  switch (me.data.kind) {
    case "forbidden":
      return (
        <CenteredCard title={t("gate.noAccess.title")}>
          {/* No link to Homeowner, on purpose. */}
          <p className="body">{t("gate.noAccess.message")}</p>
          <Button onClick={signOut}>{t("prefs.signOut")}</Button>
        </CenteredCard>
      );
    case "unauthorized":
      return null;
    case "ok":
      return <>{children}</>;
  }
}
