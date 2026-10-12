import { useEffect, useState, type ReactNode } from "react";
import { lookupInvite, type LookupInviteResult } from "../api/invites";
import { useI18n } from "../i18n";
import { DEAD_INVITE_KEY, isDeadInvite } from "./deadInvite";

interface Props {
  token: string;
  /** Forget the Invite (and show sign-in). */
  onDismiss(): void;
  /** The sign-up and sign-in screens, shown under the welcome when the link is usable. */
  children: ReactNode;
}

/**
 * For a signed-out person who opened an Invite link. Checks the link first (looking never uses it up): a dead
 * link is explained instead of showing the sign-in form; a good one is welcomed above the usual sign-up and
 * sign-in screens. With an Invite pending the signed-out landing is sign-up (see resolveRoute).
 */
export function SignedOutInvite({ token, onDismiss, children }: Props) {
  const { t } = useI18n();
  const [result, setResult] = useState<LookupInviteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void lookupInvite(token).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (result === null) return <p role="status">{t("invite.checking")}</p>;

  if (isDeadInvite(result)) {
    return (
      <section aria-labelledby="invite-dead-heading">
        <h2 id="invite-dead-heading">{t("invite.signedOut.heading")}</h2>
        <p role="alert">{t(DEAD_INVITE_KEY[result.kind])}</p>
        <button type="button" className="btn" onClick={onDismiss}>
          {t("invite.dead.continue")}
        </button>
      </section>
    );
  }

  const valid = result.kind === "valid";
  return (
    <>
      <section aria-labelledby="invite-welcome-heading">
        <h2 id="invite-welcome-heading">{t("invite.signedOut.heading")}</h2>
        {valid ? <p>{t("invite.signedOut.intro")}</p> : <p role="status">{t("invite.lookup.problem")}</p>}
      </section>
      {children}
    </>
  );
}
