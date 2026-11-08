import type { FormEvent } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";
import type { ConnectProblem } from "../logic/connectFlow";

const FORM = "finances-credentials";

interface Props {
  saving: boolean;
  problem: ConnectProblem | null;
  /** Saves the pair and resolves true when it was saved. */
  onSave(clientId: string, clientSecret: string): Promise<boolean>;
  /** Set when replacing saved credentials, so the form can be dismissed. */
  onCancel?: () => void;
}

/**
 * The two fields are uncontrolled: the values live in the inputs only, are read at submit, and are cleared once
 * saved. The Secret is masked and neither field is offered to autofill or spell check.
 */
export function CredentialsForm({ saving, problem, onSave, onCancel }: Props) {
  const { t } = useI18n();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await onSave(String(data.get("clientId") ?? ""), String(data.get("clientSecret") ?? ""));
    if (saved) form.reset();
  }

  const describedBy = problem ? formErrorId(FORM) : undefined;
  return (
    <Card as="section" aria-labelledby="finances-form-heading">
      <h3 id="finances-form-heading" className="mt-0 text-lg font-bold leading-snug">
        {t("finances.form.heading")}
      </h3>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="finances-client-id">{t("finances.form.clientId")}</label>
        <input
          id="finances-client-id"
          name="clientId"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-describedby={describedBy}
        />
        <label htmlFor="finances-client-secret">{t("finances.form.clientSecret")}</label>
        <input
          id="finances-client-secret"
          name="clientSecret"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-describedby={describedBy}
        />
        <FormError form={FORM}>{problem && t(FINANCE_FAILURE_KEY[problem])}</FormError>
        <ButtonRow
          className="mt-4"
          start={
            onCancel && (
              <Button variant="secondary" disabled={saving} onClick={onCancel}>
                {t("finances.form.cancel")}
              </Button>
            )
          }
          end={
            <Button type="submit" pending={saving}>
              {t("finances.form.save")}
            </Button>
          }
        />
      </form>
    </Card>
  );
}
