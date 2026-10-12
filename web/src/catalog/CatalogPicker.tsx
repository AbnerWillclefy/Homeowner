import { useEffect, useRef } from "react";
import type { CatalogEntry } from "./api";
import type { Failure } from "../chores/api";
import { choreFacts } from "../chores/facts";
import { CardRow } from "../shared/ui/CardRow";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { catalogName } from "./name";
import { useCatalog } from "./useCatalog";

const LOAD_FAILURE_KEY: Record<Failure["kind"], MessageKey> = {
  offline: "chores.catalog.load.offline",
  error: "chores.catalog.load.error",
  "not-signed-in": "chores.notSignedIn",
};

interface Props {
  onPick(entry: CatalogEntry): void;
  onClose(): void;
}

/** The Catalog's Chores to pick from. Picking one hands it on to be pre-filled and saved like any new Chore. */
export function CatalogPicker({ onPick, onClose }: Props) {
  const { t, locale } = useI18n();
  const { state, reload } = useCatalog();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The picker appears in place of a button, so move the reader to it.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section aria-labelledby="catalog-picker-heading">
      <h3 id="catalog-picker-heading" ref={headingRef} tabIndex={-1}>
        {t("chores.catalog.heading")}
      </h3>

      {state.kind === "loading" && <p role="status">{t("chores.catalog.loading")}</p>}

      {state.kind === "failed" && (
        <>
          <p role="alert" className="text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
          {state.reason !== "not-signed-in" && (
            <Button variant="secondary" onClick={reload}>
              {t("chores.retry")}
            </Button>
          )}
        </>
      )}

      {state.kind === "ready" && (
        <ul className="p-0">
          {state.entries.map((entry) => {
            const name = catalogName(entry.id, null, entry.name, t);
            return (
              <li key={entry.id} className="list-none ps-0">
                <CardRow
                  className="mb-3"
                  actions={
                    <Button
                      variant="secondary"
                      aria-label={t("chores.catalog.add.label", { name })}
                      onClick={() => onPick(entry)}
                    >
                      {t("chores.catalog.add")}
                    </Button>
                  }
                >
                  <h4 className="mt-0 font-semibold">{name}</h4>
                  <p className="text-muted">
                    {[...choreFacts(entry, t, locale), ...(entry.perRoom ? [t("chores.catalog.perRoom")] : [])].join(" · ")}
                  </p>
                </CardRow>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="secondary" onClick={onClose}>
        {t("chores.catalog.close")}
      </Button>
    </section>
  );
}
