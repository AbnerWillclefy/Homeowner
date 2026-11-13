import { Banner, Button, Card, Dialog } from "@homeowner/bedrock";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useDeleteFinanceData } from "../hooks/useFinanceSettings";

/** "Delete my data", behind a confirmation that lists what goes. */
export function DeleteDataCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const deletion = useDeleteFinanceData();
  return (
    <Card className="gap-4">
      <h2 className="section-title">{t("settings.delete.title")}</h2>
      <p className="body text-text-muted">{t("settings.delete.hint")}</p>
      <div>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button variant="danger" loading={deletion.isPending}>
              {t("settings.delete.open")}
            </Button>
          }
          title={t("settings.delete.dialogTitle")}
          description={t("settings.delete.body")}
          cancelLabel={t("settings.delete.cancel")}
          confirmLabel={t("settings.delete.confirm")}
          onConfirm={() => deletion.mutate()}
        />
      </div>
      {deletion.isError && <Banner tone="danger">{t("settings.delete.failed")}</Banner>}
    </Card>
  );
}
