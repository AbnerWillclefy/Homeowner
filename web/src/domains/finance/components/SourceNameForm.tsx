import { useId, useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import type { FinanceSource } from "../api/api";
import { useSaveSourceName } from "../hooks/useSaveSourceName";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";
import { readSourceName, sourceNameErrorKey } from "../logic/sourceName";

/** One Source's own name. Saving sends the trimmed text; "use the bank's name" sends null and shows only while a name is set. */
export function SourceNameForm({ source, onDone }: { source: FinanceSource; onDone(): void }) {
  const { t } = useI18n();
  const save = useSaveSourceName();
  const form = `finances-source-name-${useId()}`;
  const [message, setMessage] = useState<{ key: MessageKey; onField: boolean } | null>(null);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);

  async function write(name: string | null, which: "save" | "clear") {
    setBusy(which);
    const result = await save(source.id, name);
    setBusy(null);
    if (result.kind === "ok") onDone();
    else if (result.kind === "fields") setMessage({ key: sourceNameErrorKey(result.fields.name ?? ""), onField: true });
    else setMessage({ key: FINANCE_FAILURE_KEY[result.kind], onField: false });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readSourceName(String(new FormData(event.currentTarget).get("name") ?? ""));
    if (read.ok) {
      setMessage(null);
      void write(read.name, "save");
    } else setMessage({ key: sourceNameErrorKey(read.code), onField: true });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2">
      <label htmlFor={`${form}-name`} className="mt-0">
        {t("finances.sourceName.label")}
      </label>
      <input
        id={`${form}-name`}
        name="name"
        type="text"
        maxLength={60}
        autoComplete="off"
        // Renomear is gone once the form opens, so focus moves to the field.
        autoFocus
        defaultValue={source.name}
        aria-invalid={Boolean(message?.onField)}
        aria-describedby={message ? formErrorId(form) : undefined}
      />
      <FormError form={form}>{message && t(message.key)}</FormError>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy !== null} onClick={onDone}>
          {t("finances.billDays.cancel")}
        </Button>
        {source.name !== source.bankName && (
          <Button variant="secondary" disabled={busy !== null} pending={busy === "clear"} onClick={() => void write(null, "clear")}>
            {t("finances.sourceName.useBank")}
          </Button>
        )}
        <Button type="submit" disabled={busy !== null} pending={busy === "save"}>
          {t("finances.billDays.save")}
        </Button>
      </div>
    </form>
  );
}
