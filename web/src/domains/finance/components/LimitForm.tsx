import { useId, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { readIncome } from "../logic/income";
import { centsToInput, formatCents } from "../logic/money";

const PROBLEM_KEY = { empty: "finances.limit.empty", zero: "finances.limit.zero", junk: "finances.limit.junk" } as const;

/**
 * The monthly limit of one category, set or removed from inside the opened category. The bar changes at once
 * (`onSave` is optimistic); the `role="status"` line confirms, and a field problem or a failed write is said beside the field.
 */
export function LimitForm({ limit, onSave }: { limit: number | undefined; onSave: (cents: number | null) => Promise<"saved" | "failed"> }) {
  const { t, locale } = useI18n();
  const form = `finances-limit-${useId()}`;
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<keyof typeof PROBLEM_KEY | "failed" | null>(null);
  const [done, setDone] = useState("");

  async function write(cents: number | null) {
    setProblem(null);
    setDone("");
    const outcome = await onSave(cents);
    if (outcome === "failed") return setProblem("failed");
    setDone(cents === null ? t("finances.limit.removed") : t("finances.limit.saved", { amount: formatCents(cents, locale) }));
    if (cents === null) input.current?.focus(); // the Remove button is gone now
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readIncome(String(new FormData(event.currentTarget).get("limit") ?? ""));
    if ("problem" in read) {
      setDone("");
      setProblem(read.problem);
    } else void write(read.cents);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <label htmlFor={`${form}-input`} className="mt-0">
        {t("finances.limit.label")}
      </label>
      <input
        // A new key puts the stored value back in the field, after a save, a removal or a rollback.
        key={limit ?? "none"}
        ref={input}
        id={`${form}-input`}
        name="limit"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={limit === undefined ? "" : centsToInput(limit, locale)}
        aria-invalid={problem !== null}
        aria-describedby={problem ? formErrorId(form) : undefined}
      />
      <FormError form={form}>{problem && t(problem === "failed" ? "finances.limit.failed" : PROBLEM_KEY[problem])}</FormError>
      <p role="status" className="my-0 text-sm font-semibold">
        {done}
      </p>
      <ButtonRow
        className="mt-3"
        start={
          limit !== undefined && (
            <Button variant="secondary" onClick={() => void write(null)}>
              {t("finances.limit.remove")}
            </Button>
          )
        }
        end={<Button type="submit">{t("finances.limit.save")}</Button>}
      />
    </form>
  );
}
