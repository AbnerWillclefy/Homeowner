import { ArrowLeft } from "lucide-react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import { ME_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { useNameForm } from "../hooks/useNameForm";
import { MeLoadFailed } from "./MeLoadFailed";

const FORM = "me-name";
const INPUT_ID = "me-name-input";
const HINT_ID = "me-name-hint";

function NameForm({ initial }: { initial: string }) {
  const { t } = useI18n();
  const form = useNameForm(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    form.submit();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* The photo area goes here (ticket #235). */}
      <div>
        <label htmlFor={INPUT_ID}>{t("me.edit.nameLabel")}</label>
        {/* No maxLength on purpose: a paste over the limit must show the message, not be cut silently. */}
        <input
          id={INPUT_ID}
          type="text"
          autoComplete="name"
          value={form.value}
          onChange={(event) => form.change(event.target.value)}
          aria-invalid={form.problem === null ? undefined : true}
          aria-describedby={form.problem === null ? HINT_ID : `${HINT_ID} ${formErrorId(FORM)}`}
        />
        <p className="mt-1 mb-0 flex items-start justify-between gap-3 text-sm text-muted">
          <span id={HINT_ID}>{t("me.edit.nameHint")}</span>
          {/* The count is not announced on every key: the error message is the live part. */}
          <span className="shrink-0 font-semibold">{t("me.edit.counter", { count: form.count, max: form.max })}</span>
        </p>
        <FormError form={FORM}>{form.problem !== null && t(form.problem, { max: form.max })}</FormError>
      </div>
      <Button type="submit" fullWidth disabled={!form.canSave} pending={form.saving}>
        {t("me.edit.save")}
      </Button>
    </form>
  );
}

/**
 * The edit screen under Me: a route, not a dialog. Back returns to Me and discards what was typed (there is no
 * "unsaved changes" prompt). It edits the display name; the photo area is added by its own ticket.
 */
export function MeEdit() {
  const { t } = useI18n();
  const { me } = useShell();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ms-3">
          <Link to={ME_PATH}>
            <ArrowLeft aria-hidden="true" size={20} />
            {t("me.edit.back")}
          </Link>
        </Button>
      </div>
      <PageHeader title={t("me.edit.heading")} />
      {me.state.kind === "ready" && <NameForm initial={me.state.me.displayName ?? ""} />}
      {me.state.kind === "loading" && <p role="status">{t("profile.loading")}</p>}
      {me.state.kind === "failed" && <MeLoadFailed className="items-start" />}
    </div>
  );
}
