import { useRef, useState } from "react";
import type { CatalogEntry } from "../catalog/api";
import { createChore, updateChore, type Chore } from "./api";
import { CatalogPicker } from "../catalog/CatalogPicker";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { Card } from "../shared/ui/Card";
import { formFromEntry } from "../catalog/review";
import { useToast } from "../shared/ui/useToast";
import { useI18n } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { GroupHeading } from "../shared/ui/GroupHeading";
import { PageHeader } from "../shared/ui/PageHeader";
import { categoryLabel, labelText } from "../profile/labels";
import { CategoryTile } from "./FactList";
import { groupByCategory } from "./groups";
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
 * A Home's Chores grouped by Category, with add (by hand or from the Catalog) at the top, and edit and delete
 * on each. Rendered inside the Home section, so it only
 * exists while the signed-in User has a Home.
 */
export function ChoresSection() {
  const { t } = useI18n();
  const toast = useToast();
  const { state, reload, upsert, remove } = useChores();
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const headingRef = useRef<HTMLHeadingElement>(null);

  // After a form closes or a Chore goes away, the focused element is gone: land on the heading.
  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function settle() {
    setEditing({ kind: "none" });
    focusHeading();
  }

  const onSaved = (saved: Chore) => {
    upsert(saved);
    toast.show({ messageKey: "chores.form.saved", tone: "success" });
    settle();
  };
  const onCancel = () => settle();

  function open(next: Editing) {
    setEditing(next);
  }

  return (
    <section aria-labelledby="chores-heading" className="mt-0">
      <PageHeader id="chores-heading" headingRef={headingRef} title={t("chores.heading")}>
        {state.kind === "ready" && state.chores.length > 0 && t("chores.count", { count: state.chores.length })}
      </PageHeader>

      {state.kind === "loading" && <p role="status">{t("chores.loading")}</p>}

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
        <div className="flex flex-col gap-8">
          {(editing.kind === "none" || editing.kind === "edit") && (
            <ButtonRow>
              <Button onClick={() => open({ kind: "new" })}>{t("chores.add")}</Button>
              <Button variant="secondary" onClick={() => open({ kind: "catalog" })}>
                {t("chores.addFromCatalog")}
              </Button>
            </ButtonRow>
          )}

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

          {state.chores.length === 0 && editing.kind === "none" && (
            <Card className="border-dashed">
              <p className="my-0 text-muted">{t("chores.empty")}</p>
            </Card>
          )}

          {groupByCategory(state.chores, state.categories).map((group) => (
            <section key={group.category} aria-labelledby={`chores-${group.category}`} className="mt-0">
              <GroupHeading count={group.chores.length} icon={<CategoryTile category={group.category} />}>
                <span id={`chores-${group.category}`}>{labelText(t, categoryLabel(group.category))}</span>
              </GroupHeading>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {group.chores.map((chore: Chore) =>
                  editing.kind === "edit" && editing.id === chore.id ? (
                    <li key={chore.id} className="my-0">
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
                        // Another Chore's open form keeps what was typed in it, so this does not call settle.
                        focusHeading();
                      }}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
