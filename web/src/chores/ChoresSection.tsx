import { useRef, useState } from "react";
import type { CatalogEntry } from "../api/catalog";
import { createChore, updateChore, type Chore } from "../api/chores";
import { CatalogPicker } from "../catalog/CatalogPicker";
import { formFromEntry } from "../catalog/review";
import { useI18n } from "../i18n";
import { ChoreForm } from "./ChoreForm";
import { ChoreItem } from "./ChoreItem";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { emptyForm, formFromChore } from "./form";
import { useChores } from "./useChores";

/** Which form is open: none, a new Chore, the Chore with this id, or one of the two Catalog steps. */
type Editing =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  /** Choosing a Catalog Chore. */
  | { kind: "catalog" }
  /** A new Chore pre-filled from this Catalog entry. */
  | { kind: "fromCatalog"; entry: CatalogEntry };

/**
 * A Home's Chores: the list, with add, edit and delete. Rendered inside the Home section, so it only
 * exists while the signed-in User has a Home.
 */
export function ChoresSection() {
  const { t } = useI18n();
  const { state, reload, upsert, remove } = useChores();
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const [notice, setNotice] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // After a form closes or a Chore goes away, the focused element is gone: land on the heading.
  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function settle(message: string | null) {
    setNotice(message);
    setEditing({ kind: "none" });
    focusHeading();
  }

  const onSaved = (saved: Chore) => {
    upsert(saved);
    settle(t("chores.form.saved"));
  };
  const onCancel = () => settle(null);

  function open(next: Editing) {
    setNotice(null);
    setEditing(next);
  }

  return (
    <section aria-labelledby="chores-heading">
      <h2 id="chores-heading" ref={headingRef} tabIndex={-1}>
        {t("chores.heading")}
      </h2>

      {state.kind === "loading" && <p role="status">{t("chores.loading")}</p>}

      {state.kind === "failed" && (
        <>
          <p role="alert" className="text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
          {state.reason !== "not-signed-in" && (
            <button type="button" className="btn" onClick={reload}>
              {t("chores.retry")}
            </button>
          )}
        </>
      )}

      {state.kind === "ready" && (
        <>
          <p>{t("chores.intro")}</p>
          <p role="status">{notice}</p>

          {state.chores.length === 0 && editing.kind !== "new" && <p>{t("chores.empty")}</p>}

          <ul className="p-0">
            {state.chores.map((chore: Chore) =>
              editing.kind === "edit" && editing.id === chore.id ? (
                <li key={chore.id} className="list-none ps-0">
                  <ChoreForm
                    initial={formFromChore(chore)}
                    mode="edit"
                    idKey={chore.id}
                    categories={state.categories}
                    demands={state.demands}
                    save={(input) => updateChore(chore.id, input)}
                    onSaved={onSaved}
                    onCancel={onCancel}
                  />
                </li>
              ) : (
                <ChoreItem
                  key={chore.id}
                  chore={chore}
                  onEdit={() => open({ kind: "edit", id: chore.id })}
                  onDeleted={(id) => {
                    remove(id);
                    setNotice(null);
                    // Another Chore's open form keeps what was typed in it, so this does not call settle.
                    focusHeading();
                  }}
                />
              ),
            )}
          </ul>

          {editing.kind === "new" && (
            <ChoreForm
              initial={emptyForm()}
              mode="create"
              idKey="new"
              categories={state.categories}
              demands={state.demands}
              save={createChore}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          )}

          {editing.kind === "fromCatalog" && (
            <ChoreForm
              initial={formFromEntry(editing.entry, t)}
              mode="create"
              idKey={`catalog-${editing.entry.id}`}
              categories={state.categories}
              demands={state.demands}
              save={createChore}
              onSaved={onSaved}
              onCancel={() => open({ kind: "catalog" })}
            />
          )}

          {editing.kind === "catalog" && (
            <CatalogPicker onPick={(entry) => open({ kind: "fromCatalog", entry })} onClose={onCancel} />
          )}

          {(editing.kind === "none" || editing.kind === "edit") && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => open({ kind: "new" })}>
                {t("chores.add")}
              </button>
              <button type="button" className="btn" onClick={() => open({ kind: "catalog" })}>
                {t("chores.addFromCatalog")}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
