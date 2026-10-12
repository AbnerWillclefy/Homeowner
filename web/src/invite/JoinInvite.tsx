import { useEffect, useRef, type ReactNode } from "react";
import type { FailureReason } from "../api/home";
import { AppDialog } from "../components/ui/AppDialog";
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
  /** Forget the Invite without joining. Escape and a tap outside do the same. */
  onDismiss(): void;
  /** The Invite is spent (joined) or pointless (already in that Home). */
  onFinished(outcome: JoinOutcome): void;
}

/**
 * A dialog over Today for a signed-in person with a pending Invite: a Join button, or, when they already live in
 * a Home, the warning that joining means leaving it. Every state has a title; dismissing is blocked while the
 * join request is in flight.
 */
export function JoinInvite({ token, onDismiss, onFinished }: Props) {
  const { t } = useI18n();
  const { state, join, reload } = useJoinInvite(token, onFinished);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // The warning appears after a load or a 409: move focus to its title so a screen reader announces it.
  useEffect(() => {
    if (state.kind === "warn") titleRef.current?.focus();
  }, [state.kind]);

  const failure = (reason: FailureReason | undefined) =>
    reason && (
      <p role="alert" className="text-danger">
        {t(FAILURE_KEY[reason])}
      </p>
    );

  const dialog = (title: MessageKey, dismissible: boolean, body: ReactNode) => (
    <AppDialog title={t(title)} titleRef={titleRef} dismissible={dismissible} onDismiss={onDismiss}>
      {body}
    </AppDialog>
  );

  switch (state.kind) {
    case "loading":
      return dialog("invite.join.heading", true, <p role="status">{t("invite.join.loading")}</p>);

    case "load-failed":
      return dialog(
        "invite.join.heading",
        true,
        <>
          {failure(state.reason)}
          {state.reason !== "not-signed-in" && (
            <button type="button" className="btn btn-primary" onClick={reload}>
              {t("invite.failure.retry")}
            </button>
          )}
        </>,
      );

    case "dead":
      return dialog(
        "invite.join.heading",
        true,
        <>
          <p role="alert">{t(DEAD_INVITE_KEY[state.why])}</p>
          <button type="button" className="btn" onClick={onDismiss}>
            {t("invite.dead.continue")}
          </button>
        </>,
      );

    case "warn":
      return dialog(
        "invite.leave.heading",
        true,
        <>
          <p>{t("invite.leave.warning")}</p>
          {failure(state.error)}
          <button type="button" className="btn btn-primary" onClick={() => void join(true)}>
            {t("invite.leave.confirm")}
          </button>
          <button type="button" className="btn" onClick={onDismiss}>
            {t("invite.leave.cancel")}
          </button>
        </>,
      );

    case "ready":
    case "joining": {
      const joining = state.kind === "joining";
      return dialog(
        "invite.join.heading",
        !joining,
        <>
          {state.kind === "ready" && failure(state.error)}
          <button type="button" className="btn btn-primary" disabled={joining} aria-busy={joining} onClick={() => void join(false)}>
            {joining ? t("invite.join.submitting") : t("invite.join.submit")}
          </button>
          <button type="button" className="btn" disabled={joining} onClick={onDismiss}>
            {t("invite.join.dismiss")}
          </button>
        </>,
      );
    }
  }
}
