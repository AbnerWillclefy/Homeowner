import { useId, useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import type { FinanceSource } from "../api/api";
import { useSaveBillDays } from "../hooks/useSaveBillDays";
import { readBillDays } from "../logic/billDays";

type Problems = { closeDay?: string; dueDay?: string; failed?: true };

const FIELDS = ["closeDay", "dueDay"] as const;
const PROBLEM_KEY: Record<(typeof FIELDS)[number], Record<string, MessageKey>> = {
  closeDay: { required: "finances.billDays.closeDay.required", invalid: "finances.billDays.closeDay.invalid" },
  dueDay: { required: "finances.billDays.dueDay.required", invalid: "finances.billDays.dueDay.invalid" },
};
const LABEL_KEY: Record<(typeof FIELDS)[number], MessageKey> = {
  closeDay: "finances.billDays.closeDay",
  dueDay: "finances.billDays.dueDay",
};

/** The two days of one credit card's statement, typed together: both are saved, or both cleared, never one. */
export function CardBillDaysForm({ source, onDone }: { source: FinanceSource; onDone(): void }) {
  const { t } = useI18n();
  const save = useSaveBillDays();
  const form = `finances-bill-days-${useId()}`;
  const [problems, setProblems] = useState<Problems>({});
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);

  async function write(closeDay: number | null, dueDay: number | null, which: "save" | "clear") {
    setBusy(which);
    const result = await save(source.id, closeDay, dueDay);
    setBusy(null);
    if (result.kind === "ok") onDone();
    else if (result.kind === "fields") setProblems(result.fields);
    else setProblems({ failed: true });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = readBillDays(String(data.get("closeDay") ?? ""), String(data.get("dueDay") ?? ""));
    if (read.ok) {
      setProblems({});
      void write(read.closeDay, read.dueDay, "save");
    } else setProblems(read.errors);
  }

  const first = FIELDS.find((f) => problems[f]);
  const message = problems.failed
    ? t("finances.billDays.failed")
    : first && t(PROBLEM_KEY[first][problems[first]!] ?? "finances.billDays.failed");

  return (
    <form onSubmit={submit} noValidate className="mt-2">
      <div className="flex flex-wrap gap-x-3">
        {FIELDS.map((field) => (
          <div key={field} className="min-w-0 flex-[1_1_7rem]">
            <label htmlFor={`${form}-${field}`} className="mt-0">
              {t(LABEL_KEY[field])}
            </label>
            <input
              id={`${form}-${field}`}
              name={field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={source[field] ?? ""}
              aria-invalid={Boolean(problems[field])}
              aria-describedby={problems[field] ? formErrorId(form) : undefined}
            />
          </div>
        ))}
      </div>
      <FormError form={form}>{message}</FormError>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy !== null} onClick={onDone}>
          {t("finances.billDays.cancel")}
        </Button>
        {source.closeDay !== null && (
          <Button variant="secondary" disabled={busy !== null} pending={busy === "clear"} onClick={() => void write(null, null, "clear")}>
            {t("finances.billDays.clear")}
          </Button>
        )}
        <Button type="submit" disabled={busy !== null} pending={busy === "save"}>
          {t("finances.billDays.save")}
        </Button>
      </div>
    </form>
  );
}
