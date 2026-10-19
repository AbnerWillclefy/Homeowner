import { Camera, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import type { Me } from "../../auth/api/meApi";
import { Avatar } from "../../residents/components/Avatar";
import { usePhotoUpload } from "../hooks/usePhotoUpload";

const FORM = "me-photo";
const LABEL_ID = "me-photo-label";
const HINT_ID = "me-photo-hint";

interface ChooseProps {
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}

/** A styled `<label>` around a visually hidden file input: on iOS it offers the camera and the library. */
function ChooseButton({ label, disabled, onFile }: ChooseProps) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so choosing the same file again still fires `change`.
    event.target.value = "";
    if (file !== undefined) onFile(file);
  }
  return (
    <Button asChild variant="secondary">
      <label
        className={`mt-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
          disabled ? "cursor-not-allowed border-dashed text-muted" : "cursor-pointer"
        }`}
      >
        <Camera aria-hidden="true" size={16} />
        {label}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          aria-describedby={HINT_ID}
          onChange={change}
        />
      </label>
    </Button>
  );
}

function Preview({ me, previewUrl, caption }: { me: Me; previewUrl: string; caption: string }) {
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <div className="flex items-end gap-4">
        <Avatar size="lg" resident={{ name: me.name, userId: me.id, photoUrl: previewUrl }} />
        <Avatar size="md" resident={{ name: me.name, userId: me.id, photoUrl: previewUrl }} />
      </div>
      <figcaption className="text-sm font-semibold text-muted">{caption}</figcaption>
    </figure>
  );
}

/**
 * The photo area of the edit screen: the current photo, then a choice, a preview at the Me size and the list
 * size, and Save. There is no crop editor; the app crops the centre to a square. Nothing is sent before Save.
 */
export function PhotoPicker({ me }: { me: Me }) {
  const { t } = useI18n();
  const photo = usePhotoUpload(me);
  const { state } = photo;

  const preview = "previewUrl" in state ? state : null;
  const saving = state.kind === "saving";
  const message: MessageKey | null = state.kind === "failed" ? state.problem : photo.problem;

  return (
    <section aria-labelledby={LABEL_ID} className="flex flex-col items-center gap-3 text-center">
      <p id={LABEL_ID} className="my-0 font-semibold">
        {t("me.photo.label")}
      </p>

      {preview === null ? (
        <Avatar size="lg" resident={{ name: me.name, userId: me.id, photoUrl: me.photoUrl }} />
      ) : (
        <Preview me={me} previewUrl={preview.previewUrl} caption={t("me.photo.previewCaption")} />
      )}

      {state.kind === "preparing" && <p role="status" className="my-0 text-muted">{t("me.photo.preparing")}</p>}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <ChooseButton
          label={t(preview === null && me.photoUrl === null ? "me.photo.choose" : "me.photo.another")}
          disabled={photo.busy}
          onFile={photo.choose}
        />
        {preview !== null && (
          <Button pending={saving} disabled={photo.busy && !saving} onClick={photo.save}>
            {t(state.kind === "failed" ? "me.photo.retry" : "me.photo.save")}
          </Button>
        )}
        {preview === null && me.photoUrl !== null && (
          <Button variant="danger" leadingIcon={<Trash2 aria-hidden="true" size={16} />} pending={photo.removing} disabled={photo.busy && !photo.removing} onClick={photo.remove}>
            {t("me.photo.remove")}
          </Button>
        )}
      </div>

      <p id={HINT_ID} className="my-0 text-sm text-muted">
        {t("me.photo.hint")}
      </p>
      <FormError form={FORM}>{message !== null && t(message)}</FormError>
    </section>
  );
}
