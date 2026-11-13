import { Button, Card } from "@homeowner/bedrock";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { Preferences } from "../../shared/Preferences";
import { CredentialsCard } from "./components/CredentialsCard";
import { DeleteDataCard } from "./components/DeleteDataCard";
import { IncomeCard } from "./components/IncomeCard";
import { NotificationsCard } from "./components/NotificationsCard";

/** Finances settings: Monthly income, saved credentials, notifications, preferences, deleting the data and signing out. */
export function SettingsPage() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.settings")}</h1>
      <IncomeCard />
      <CredentialsCard />
      <NotificationsCard />
      <Card className="gap-4">
        <h2 className="section-title">{t("prefs.title")}</h2>
        <Preferences />
      </Card>
      <DeleteDataCard />
      <div>
        <Button variant="secondary" onClick={signOut}>
          {t("prefs.signOut")}
        </Button>
      </div>
    </section>
  );
}
