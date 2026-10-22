import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { inviteQuery } from "../api/queries";
import { Card } from "../../../shared/ui/Card";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { DEAD_INVITE_KEY, isDeadInvite } from "../logic/deadInvite";

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
  const { data: found, isError } = useQuery(inviteQuery(token));

  // Still checking, or the check itself failed (offline or an error): the person can still sign up, with a note.
  if (found === undefined && !isError) return <p role="status">{t("invite.checking")}</p>;
  const result = found ?? { kind: "error" as const };

  if (isDeadInvite(result)) {
    return (
      <Card as="section" aria-labelledby="invite-dead-heading">
        <h2 id="invite-dead-heading">{t("invite.signedOut.heading")}</h2>
        <p role="alert">{t(DEAD_INVITE_KEY[result.kind])}</p>
        <Button variant="secondary" fullWidth className="mt-2" onClick={onDismiss}>
          {t("invite.dead.continue")}
        </Button>
      </Card>
    );
  }

  const valid = result.kind === "valid";
  return (
    <>
      <Card as="section" aria-labelledby="invite-welcome-heading">
        <h2 id="invite-welcome-heading">{t("invite.signedOut.heading")}</h2>
        {!valid && <p role="status">{t("invite.lookup.problem")}</p>}
      </Card>
      {children}
    </>
  );
}
