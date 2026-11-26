import { Row, Sheet } from "@homeowner/bedrock";
import { ChevronRight, Share2, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { RowTile } from "../../../shared/ui/RowTile";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { useToast } from "../../../shared/ui/useToast";
import { createInvite } from "../api/api";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { inviteLink, shareInvite } from "../logic/share";

const CREATE_FAILURE_KEY = {
  "too-many": "invite.share.tooMany",
  none: "invite.share.noHome",
  offline: "invite.share.offline",
  "not-signed-in": "invite.failure.notSignedIn",
  error: "invite.share.error",
} as const satisfies Record<string, MessageKey>;

/**
 * A Row of the Residents list ("Convidar um morador") that opens a Sheet: make a single-use Invite and hand it to
 * the phone's share sheet, or copy the link when the browser has no share sheet. The link is built here from the token and the app's own address. The result
 * is a toast: nothing is left to decide, and the button stays for another try.
 */
export function InviteShare() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
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
    <>
      <Row
        asChild
        className="my-0"
        leading={<RowTile icon={UserPlus} tone="brand" />}
        title={t("invite.share.heading")}
        caption={t("invite.row.caption")}
        trailing={<ChevronRight size={20} aria-hidden="true" className="text-muted" />}
      >
        <button ref={openerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} />
      </Row>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={openerRef}
        title={t("invite.share.heading")}
        subtitle={t("invite.share.hint")}
        closeLabel={t("home.settings.sheet.close")}
        footer={
          <Button pending={working} leadingIcon={<Share2 aria-hidden="true" className="size-4" />} onClick={() => void onClick()}>
            {t("invite.share.button")}
          </Button>
        }
      >
        {null}
      </Sheet>
    </>
  );
}
