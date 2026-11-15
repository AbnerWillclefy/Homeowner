import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/** A card's heading and, at its end, the link to the screen that holds the detail. */
export function CardHead({ label, to, name }: { label: ReactNode; to?: string; name?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="card-label text-text-muted">{label}</h2>
      {to && (
        <Link
          to={to}
          aria-label={t("overview.open", { name: name ?? "" })}
          className="-m-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
