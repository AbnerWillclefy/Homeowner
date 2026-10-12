import { CardRow } from "../shared/ui/CardRow";
import { useSubmitOnce } from "../shared/ui/useSubmitOnce";
import { useToast } from "../shared/ui/useToast";
import { createInvite } from "../api/invites";
import { useI18n, type MessageKey } from "../i18n";
import { Button } from "../shared/ui/Button";
import { inviteLink, shareInvite } from "./share";

const CREATE_FAILURE_KEY = {
  "too-many": "invite.share.tooMany",
  none: "invite.share.noHome",
  offline: "invite.share.offline",
  "not-signed-in": "invite.failure.notSignedIn",
  error: "invite.share.error",
} as const satisfies Record<string, MessageKey>;

/**
 * In the Home section: make a single-use Invite and hand it to the phone's share sheet, or copy the link when
 * the browser has no share sheet. The link is built here from the token and the app's own address. The result
 * is a toast: nothing is left to decide, and the button stays for another try.
 */
export function InviteShare() {
  const { t } = useI18n();
  const toast = useToast();

  const { run: onClick, pending: working } = useSubmitOnce(async () => {
    const made = await createInvite();
    if (made.kind !== "ok") {
      return toast.show({ messageKey: CREATE_FAILURE_KEY[made.kind], tone: "error" });
    }
    const outcome = await shareInvite({
      title: t("invite.share.title"),
      text: t("invite.share.text"),
      url: inviteLink(globalThis.location.origin, made.token),
    });
    // Closing the share sheet is the person's choice: nothing to confirm.
    if (outcome === "shared") toast.show({ messageKey: "invite.share.shared", tone: "success" });
    else if (outcome === "copied") toast.show({ messageKey: "invite.share.copied", tone: "success" });
    else if (outcome === "failed") toast.show({ messageKey: "invite.share.failed", tone: "error" });
  });

  return (
    <CardRow
      as="section"
      aria-labelledby="invite-share-heading"
      className="items-center"
      actions={
        <Button variant="primary" disabled={working} aria-busy={working} onClick={() => void onClick()}>
          {working ? t("invite.share.creating") : t("invite.share.button")}
        </Button>
      }
    >
      <h2 id="invite-share-heading" className="my-0">
        {t("invite.share.heading")}
      </h2>
    </CardRow>
  );
}
