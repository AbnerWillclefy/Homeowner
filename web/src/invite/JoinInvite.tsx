import { useEffect, useRef } from "react";
import type { FailureReason } from "../api/home";
import { useI18n, type MessageKey } from "../i18n";
import { DEAD_INVITE_KEY } from "./deadInvite";
import { useJoinInvite, type JoinOutcome } from "./useJoinInvite";

const FAILURE_KEY: Record<FailureReason, MessageKey> = {
  offline: "invite.failure.offline",
  error: "invite.failure.error",
  "not-signed-in": "invite.failure.notSignedIn",
};

interface Props {
  token: string;
  /** Forget the Invite without joining. */
  onDismiss(): void;
  /** The Invite is spent (joined) or pointless (already in that Home). */
  onFinished(outcome: JoinOutcome): void;
}

/**
 * For a signed-in person with a pending Invite: a Join button, or, when they already live in a Home, the
 * warning that joining means leaving it. This replaces the create-a-Home form while the Invite is pending.
 */
export function JoinInvite({ token, onDismiss, onFinished }: Props) {
  const { t } = useI18n();
  const { state, join, reload } = useJoinInvite(token, onFinished);
  const warnRef = useRef<HTMLHeadingElement>(null);

  // The warning appears after a load or a 409: move focus to it so a screen reader announces it.
  useEffect(() => {
    if (state.kind === "warn") warnRef.current?.focus();
  }, [state.kind]);

  const failure = (reason: FailureReason | undefined) =>
    reason && (
      <p role="alert" className="text-danger">
        {t(FAILURE_KEY[reason])}
      </p>
    );

  switch (state.kind) {
    case "loading":
      return <p role="status">{t("invite.join.loading")}</p>;

    case "load-failed":
      return (
        <section aria-labelledby="invite-join-heading">
          <h2 id="invite-join-heading">{t("invite.join.heading")}</h2>
          {failure(state.reason)}
          {state.reason !== "not-signed-in" && (
            <button type="button" className="btn btn-primary" onClick={reload}>
              {t("invite.failure.retry")}
            </button>
          )}
        </section>
      );

    case "dead":
      return (
        <section aria-labelledby="invite-join-heading">
          <h2 id="invite-join-heading">{t("invite.join.heading")}</h2>
          <p role="alert">{t(DEAD_INVITE_KEY[state.why])}</p>
          <button type="button" className="btn" onClick={onDismiss}>
            {t("invite.dead.continue")}
          </button>
        </section>
      );

    case "warn":
      return (
        <section aria-labelledby="invite-leave-heading">
          <h2 id="invite-leave-heading" ref={warnRef} tabIndex={-1}>
            {t("invite.leave.heading")}
          </h2>
          <p>{t("invite.leave.warning")}</p>
          {failure(state.error)}
          <button type="button" className="btn btn-primary" onClick={() => void join(true)}>
            {t("invite.leave.confirm")}
          </button>
          <button type="button" className="btn" onClick={onDismiss}>
            {t("invite.leave.cancel")}
          </button>
        </section>
      );

    case "ready":
    case "joining": {
      const joining = state.kind === "joining";
      return (
        <section aria-labelledby="invite-join-heading">
          <h2 id="invite-join-heading">{t("invite.join.heading")}</h2>
          <p>{t("invite.join.intro")}</p>
          {state.kind === "ready" && failure(state.error)}
          <button type="button" className="btn btn-primary" disabled={joining} onClick={() => void join(false)}>
            {joining ? t("invite.join.submitting") : t("invite.join.submit")}
          </button>
          <button type="button" className="btn" disabled={joining} onClick={onDismiss}>
            {t("invite.join.dismiss")}
          </button>
        </section>
      );
    }
  }
}
