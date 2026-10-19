import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";

/** The inline message with Retry shown where `GET /me` failed; `className` sets the alignment. */
export function MeLoadFailed({ className }: { className: string }) {
  const { t } = useI18n();
  const { me } = useShell();
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <p role="alert" className="my-0 font-semibold">
        {t("me.header.loadFailed")}
      </p>
      <Button variant="secondary" onClick={me.reload}>
        {t("me.header.retry")}
      </Button>
    </div>
  );
}
