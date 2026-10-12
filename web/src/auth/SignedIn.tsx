import { CardRow } from "../components/ui/CardRow";
import { useI18n } from "../i18n";
import { Button } from "../shared/ui/Button";
import { EMAIL_MARKER, splitAtEmail } from "./emailMarker";

interface Props {
  email: string | null;
  offline: boolean;
  onSignOut(): void;
}

export function SignedIn({ email, offline, onSignOut }: Props) {
  const { t } = useI18n();
  const [before, after] = splitAtEmail(t("signedIn.as", { email: EMAIL_MARKER }));
  return (
    <CardRow
      as="section"
      aria-labelledby="signedin-heading"
      actions={
        <Button variant="secondary" onClick={onSignOut}>
          {t("signedIn.signOut")}
        </Button>
      }
    >
      <h2 id="signedin-heading" className="mt-0">
        {t("signedIn.heading")}
      </h2>
      <p>
        {before}
        <strong>{email ?? t("signedIn.emailFallback")}</strong>
        {after}
      </p>
      {offline && <p role="status">{t("signedIn.offline")}</p>}
    </CardRow>
  );
}
