import { Banner, Button, Card, Dialog, Input, Sheet } from "@homeowner/bedrock";
import { Ellipsis } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import { useCredentials } from "../hooks/useFinanceSettings";

/** The remove confirmation, with its own open state so the phone Sheet and the desktop row can each hold one. */
function RemoveButton({ remove }: { remove(): void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm" variant="secondary">{t("settings.creds.remove")}</Button>}
      title={t("settings.creds.removeTitle")}
      description={t("settings.creds.removeBody")}
      cancelLabel={t("settings.creds.cancel")}
      confirmLabel={t("settings.creds.removeConfirm")}
      onConfirm={remove}
    />
  );
}

const FAILURE: Record<"invalid" | "rejected" | "error", MessageKey> = {
  invalid: "settings.creds.invalid",
  rejected: "settings.creds.rejected",
  error: "settings.creds.failed",
};

/**
 * The MeuPluggy credentials. The two fields are uncontrolled: the values live in the inputs only, are read at submit
 * and cleared once saved; the Secret is masked and neither is offered to autofill. Saved credentials are never shown.
 */
export function CredentialsCard() {
  const { t } = useI18n();
  const { saved, loading, failed, save, remove } = useCredentials();
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    const result = await save(String(data.get("clientId") ?? "").trim(), String(data.get("clientSecret") ?? "").trim());
    setSaving(false);
    setFailure(result === "ok" ? null : FAILURE[result]);
    if (result === "ok") {
      form.reset();
      setEditing(false);
    }
  }

  const removeSaved = () => void remove().then((ok) => setFailure(ok ? null : "settings.creds.failed"));

  const form = (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <Input label={t("settings.creds.clientId")} name="clientId" type="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      <Input label={t("settings.creds.clientSecret")} name="clientSecret" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>
          {t("settings.creds.save")}
        </Button>
        {editing && (
          <Button variant="secondary" disabled={saving} onClick={() => setEditing(false)}>
            {t("settings.creds.cancel")}
          </Button>
        )}
      </div>
      {failure && <Banner tone="danger">{t(failure)}</Banner>}
    </form>
  );
  return (
    <Card className="gap-4">
      <h2 className="section-title">{t("settings.creds.title")}</h2>
      {failed ? (
        <Banner tone="danger">{t("settings.creds.loadFailed")}</Banner>
      ) : (
        !loading && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="body">{t(saved ? "settings.creds.savedTitle" : "settings.creds.none")}</span>
              {saved && <span className="caption text-text-muted">{t("settings.creds.encrypted")}</span>}
            </div>
            {saved && (
              <>
                <Button
                  icon={Ellipsis}
                  variant="secondary"
                  className="w-control-lg px-0 desktop:hidden"
                  onClick={() => {
                    setFailure(null);
                    setEditing(true);
                  }}
                >
                  <span className="sr-only">{t("settings.creds.manage")}</span>
                </Button>
                <div className="hidden gap-2 desktop:flex">
                  <Button size="sm" variant="secondary" onClick={() => {
                      setFailure(null);
                      setEditing(true);
                    }}>
                    {t("settings.creds.replace")}
                  </Button>
                  <RemoveButton remove={removeSaved} />
                </div>
              </>
            )}
          </div>
        )
      )}
      {!loading && saved === false && form}
      {saved && (
        <Sheet open={editing} onOpenChange={setEditing} title={t("settings.creds.title")} closeLabel={t("app.close")}>
          {form}
          <div className="mt-4 desktop:hidden">
            <RemoveButton remove={removeSaved} />
          </div>
        </Sheet>
      )}
      {failure && saved && !editing && <Banner tone="danger">{t(failure)}</Banner>}
    </Card>
  );
}
