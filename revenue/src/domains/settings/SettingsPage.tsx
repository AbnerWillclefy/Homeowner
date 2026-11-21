import { Button, Card } from "@homeowner/bedrock";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { Preferences } from "../../shared/Preferences";
import { CredentialsCard } from "./components/CredentialsCard";
import { DeleteDataCard } from "./components/DeleteDataCard";
import { NotificationsCard } from "./components/NotificationsCard";
import { PlanningCard } from "./components/PlanningCard";

/** Settings, in the artboard's order: planning, appearance, alerts, the Pluggy connection, deleting the data; signing out stays at the bottom. */
export function SettingsPage() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.settings")} subtitle={t("settings.subtitle")} />
      <PlanningCard />
      <Card className="gap-4">
        <h2 className="section-title">{t("settings.appearance.title")}</h2>
        <Preferences rows />
      </Card>
      <NotificationsCard />
      <CredentialsCard />
      <DeleteDataCard />
      <div>
        <Button variant="secondary" onClick={signOut}>
          {t("prefs.signOut")}
        </Button>
      </div>
    </section>
  );
}
