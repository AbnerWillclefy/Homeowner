import { UserRound } from "lucide-react";
import { SectionCard } from "../../../shared/ui/SectionCard";
import { useI18n } from "../../../shared/i18n";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Button } from "../../../shared/ui/Button";
import { EMAIL_MARKER, splitAtEmail } from "../logic/emailMarker";

interface Props {
  email: string | null;
  offline: boolean;
  onSignOut(): void;
}

export function SignedIn({ email, offline, onSignOut }: Props) {
  const { t } = useI18n();
  const [before, after] = splitAtEmail(t("signedIn.as", { email: EMAIL_MARKER }));
  return (
    <SectionCard id="signedin-heading" icon={UserRound} title={t("signedIn.heading")}>
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
      <ButtonRow stretch>
        <Button variant="secondary" onClick={onSignOut}>
          {t("signedIn.signOut")}
        </Button>
      </ButtonRow>
    </SectionCard>
  );
}
