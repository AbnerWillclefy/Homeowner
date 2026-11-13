import { Button, Input } from "@homeowner/bedrock";
import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { Source } from "../api";
import { useSaveSourceName } from "../hooks/useSources";
import { FAILURE_KEY } from "../logic/failureMessages";
import { readSourceName, sourceNameErrorKey } from "../logic/sourceName";

/** One Source's own name. Saving sends the trimmed text; "use the bank's name" sends null and shows only while a name is set. */
export function SourceNameForm({ source, onDone }: { source: Source; onDone(): void }) {
  const { t } = useI18n();
  const save = useSaveSourceName();
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);

  async function write(name: string | null, which: "save" | "clear") {
    setBusy(which);
    const result = await save(source.id, name);
    setBusy(null);
    if (result.kind === "ok") onDone();
    else setMessage(result.kind === "fields" ? sourceNameErrorKey(result.fields.name ?? "") : FAILURE_KEY[result.kind]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readSourceName(String(new FormData(event.currentTarget).get("name") ?? ""));
    if (read.ok) {
      setMessage(null);
      void write(read.name, "save");
    } else setMessage(sourceNameErrorKey(read.code));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {/* The Rename button is gone once the form opens, so focus moves to the field. */}
      <Input label={t("sources.name.label")} name="name" type="text" maxLength={60} autoComplete="off" autoFocus defaultValue={source.name} error={message ? t(message) : undefined} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy !== null} onClick={onDone}>
          {t("sources.name.cancel")}
        </Button>
        {source.name !== source.bankName && (
          <Button variant="secondary" disabled={busy !== null} loading={busy === "clear"} onClick={() => void write(null, "clear")}>
            {t("sources.name.useBank")}
          </Button>
        )}
        <Button type="submit" disabled={busy !== null} loading={busy === "save"}>
          {t("sources.name.save")}
        </Button>
      </div>
    </form>
  );
}
