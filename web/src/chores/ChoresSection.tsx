import { useRef, useState } from "react";
import { createChore, updateChore, type Chore } from "../api/chores";
import { useI18n } from "../i18n";
import { ChoreForm } from "./ChoreForm";
import { ChoreItem } from "./ChoreItem";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { useChores } from "./useChores";

/** Which form is open: none, a new Chore, or the Chore with this id. */
type Editing = { kind: "none" } | { kind: "new" } | { kind: "edit"; id: string };

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
                    chore={chore}
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
                  onEdit={() => {
                    setNotice(null);
                    setEditing({ kind: "edit", id: chore.id });
                  }}
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

          {editing.kind === "new" ? (
            <ChoreForm
              chore={null}
              categories={state.categories}
              demands={state.demands}
              save={createChore}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setNotice(null);
                setEditing({ kind: "new" });
              }}
            >
              {t("chores.add")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
