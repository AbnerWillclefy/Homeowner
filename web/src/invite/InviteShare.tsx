import { useState } from "react";
import { createInvite } from "../api/invites";
import { useI18n, type MessageKey } from "../i18n";
import { inviteLink, shareInvite } from "./share";

type Status = { kind: "idle" } | { kind: "working" } | { kind: "done"; key: MessageKey; problem: boolean };

/**
 * In the Home section: make a single-use Invite and hand it to the phone's share sheet, or copy the link when
 * the browser has no share sheet. The link is built here from the token and the app's own address.
 */
export function InviteShare() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onClick() {
    setStatus({ kind: "working" });
    const made = await createInvite();
    if (made.kind !== "ok") {
      const key: MessageKey =
        made.kind === "too-many"
          ? "invite.share.tooMany"
          : made.kind === "none"
            ? "invite.share.noHome"
            : made.kind === "offline"
              ? "invite.share.offline"
              : made.kind === "not-signed-in"
                ? "invite.failure.notSignedIn"
                : "invite.share.error";
      return setStatus({ kind: "done", key, problem: true });
    }
    const outcome = await shareInvite({
      title: t("invite.share.title"),
      text: t("invite.share.text"),
      url: inviteLink(globalThis.location.origin, made.token),
    });
    const key: MessageKey = {
      shared: "invite.share.shared",
      copied: "invite.share.copied",
      cancelled: "invite.share.cancelled",
      failed: "invite.share.failed",
    }[outcome] as MessageKey;
    setStatus({ kind: "done", key, problem: outcome === "failed" });
  }

  const working = status.kind === "working";
  return (
    <section aria-labelledby="invite-share-heading">
      <h2 id="invite-share-heading">{t("invite.share.heading")}</h2>
      <p>{t("invite.share.intro")}</p>
      <button type="button" className="btn" disabled={working} onClick={() => void onClick()}>
        {working ? t("invite.share.creating") : t("invite.share.button")}
      </button>
      <p role={status.kind === "done" && status.problem ? "alert" : "status"}>
        {status.kind === "done" && t(status.key)}
      </p>
    </section>
  );
}
