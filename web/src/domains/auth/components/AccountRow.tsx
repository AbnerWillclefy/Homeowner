import { KeyRound } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { IconTile } from "../../../shared/ui/IconTile";
import { SheetRow } from "../../../shared/ui/SheetRow";
import { EMAIL_MARKER, splitAtEmail } from "../logic/emailMarker";

interface Props {
  email: string | null;
  offline: boolean;
  onSignOut(): void;
}

/** The account row of Me: its Sheet says who is signed in and has Sign out. */
export function AccountRow({ email, offline, onSignOut }: Props) {
  const { t } = useI18n();
  const [before, after] = splitAtEmail(t("signedIn.as", { email: EMAIL_MARKER }));
  return (
    <SheetRow
      icon={<IconTile icon={KeyRound} className="bg-surface-sunken text-text-muted" />}
      title={t("me.account.title")}
      caption={t("me.account.caption")}
    >
      <div className="flex flex-col gap-3 pb-4">
        <p className="my-0">
          {before}
          <strong>{email ?? t("signedIn.emailFallback")}</strong>
          {after}
        </p>
        {offline && (
          <p role="status" className="my-0 text-muted">
            {t("signedIn.offline")}
          </p>
        )}
        <Button variant="secondary" fullWidth onClick={onSignOut}>
          {t("signedIn.signOut")}
        </Button>
      </div>
    </SheetRow>
  );
}
