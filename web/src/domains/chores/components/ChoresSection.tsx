import { ChoreIcon } from "@homeowner/bedrock/home";
import { Menu, EmptyState, SearchField } from "@homeowner/bedrock";
import { BookOpen, ListChecks, Plus, SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { CatalogEntry } from "../../catalog/api/api";
import { createChore, updateChore, type Chore } from "../api/api";
import { CatalogPicker } from "../../catalog/components/CatalogPicker";
import { formFromEntry } from "../../catalog/logic/review";
import { useToast } from "../../../shared/ui/useToast";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import {
  useReportFetching,
  useReportFirstLoad,
} from "../../../shared/ui/PageLoading";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { TabBody } from "../../../app/components/TabBody";
import { TabHeader } from "../../../app/components/TabHeader";
import { useShell } from "../../../app/components/ShellContext";
import { ChoreForm, type ResponsibleProps } from "./ChoreForm";
import { ChoresSkeleton } from "./ChoresSkeleton";
import { ChoreItem } from "./ChoreItem";
import { choreCategory } from "../logic/choreCategory";
import { LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { filterChores } from "../logic/filter";
import { emptyForm, formFromChore } from "../logic/form";
import { groupByCategory } from "../logic/groups";
import { useChores } from "../hooks/useChores";

/** The query parameter that opens a Chore's edit form on arrival. */
export const EDIT_PARAM = "edit";

/** Which Sheet is open: none, a new Chore, the Chore with this id, or one of the two Catalog steps. */
type Editing =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  /** Choosing a Catalog Chore. */
  | { kind: "catalog" }
  /** A new Chore pre-filled from this Catalog entry, over the Catalog. */
  | { kind: "fromCatalog"; entry: CatalogEntry };

const CHIP =
  "inline-flex min-h-11 flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium text-text aria-pressed:border-brand aria-pressed:bg-brand-soft";

/**
 * A Home's Chores: a search, Category chips, then the Chores grouped by Category. "+" adds one by hand or from the
 * Catalog; a tap on a row opens its Sheet, where it is edited or deleted (with Desfazer). Search and chip are
 * local: they start over each time the tab opens. Rendered inside the Home section, so it only exists while the
 * signed-in User has a Home.
 */
export function ChoresSection() {
  const { t } = useI18n();
  const toast = useToast();
  const { residents } = useShell();
  const { state, refreshing, reload, upsert, destroy } = useChores();
  // The page's one status announces the wait; the skeleton shows after 300ms. Only the first load and a Retry load.
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  // A refetch behind the cached lists shows the quiet indicator in the page header, never a skeleton.
  useReportFetching(refreshing);
  // A Task Sheet's two-person hint links here with ?edit=<choreId>, which opens that Chore's Sheet.
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(() => {
    const id = params.get(EDIT_PARAM);
    return id ? { kind: "edit", id } : { kind: "none" };
  });
  const [query, setQuery] = useState("");
  // The chosen Category chip's id, or null for All.
  const [chip, setChip] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  // After a Chore goes away, the focused element is gone: land on the heading.
  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  // A Sheet opened from "+" has no row to return to, so focus goes back to "+" by hand.
  function focusAdd() {
    requestAnimationFrame(() =>
      (addRef.current?.querySelector("button") ?? headingRef.current)?.focus(),
    );
  }

  const close = () => {
    if (
      editing.kind === "new" ||
      editing.kind === "catalog" ||
      editing.kind === "fromCatalog"
    )
      focusAdd();
    setEditing({ kind: "none" });
    if (params.has(EDIT_PARAM)) setParams({}, { replace: true });
  };

  const onSaved = (saved: Chore) => {
    upsert(saved);
    toast.show({ messageKey: "chores.form.saved", tone: "success" });
    close();
  };

  // The Responsible field needs the shared Residents list, which is not ready while it loads or after it failed.
  const responsibleFor = (existing: Chore | null): ResponsibleProps => ({
    residents:
      residents.state.kind === "ready" ? residents.state.residents : null,
    reloadResidents: residents.reload,
    onStored: upsert,
    existing,
  });

  const ready = state.kind === "ready";
  const editedChore =
    ready && editing.kind === "edit"
      ? state.chores.find((chore) => chore.id === editing.id)
      : undefined;
  const clearFilters = () => {
    setQuery("");
    setChip(null);
  };

  // The chips: every Category the list offers, plus any a Chore is under, each resolved to an id the app knows.
  const chipIds = ready
    ? [
        ...new Set(
          [
            ...state.categories,
            ...state.chores.map((chore) => chore.category),
          ].map((id) => choreCategory(id).id),
        ),
      ]
    : [];
  const groups = ready
    ? groupByCategory(
        filterChores(
          state.chores,
          query,
          chip,
          (chore) => choreCategory(chore.category).id,
        ),
        state.categories,
      )
    : [];

  return (
    <section aria-labelledby="chores-heading" className="mt-0">
      <TabHeader
        id="chores-heading"
        headingRef={headingRef}
        title={t("chores.heading")}
        subtitle={
          ready
            ? state.chores.length > 0
              ? t("chores.count", { count: state.chores.length })
              : t("chores.empty.subtitle")
            : undefined
        }
        tools={
          ready &&
          state.chores.length > 0 && (
            <div ref={addRef}>
              <Menu
                primary
                icon={Plus}
                label={t("chores.add")}
                closeLabel={t("chores.sheet.close")}
                items={[
                  {
                    label: t("chores.menu.new"),
                    icon: Plus,
                    onSelect: () => setEditing({ kind: "new" }),
                  },
                  {
                    label: t("chores.menu.catalog"),
                    icon: BookOpen,
                    onSelect: () => setEditing({ kind: "catalog" }),
                  },
                ]}
              />
            </div>
          )
        }
      />

      <TabBody>
        {showSkeleton && <ChoresSkeleton />}

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

        {ready && (
          <>
            {state.chores.length === 0 ? (
              <div className="flex flex-col items-stretch gap-2">
                <EmptyState
                  icon={ListChecks}
                  title={t("chores.empty.title")}
                  message={t("chores.empty.message")}
                  action={{
                    label: t("chores.menu.catalog"),
                    onClick: () => setEditing({ kind: "catalog" }),
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => setEditing({ kind: "new" })}
                >
                  {t("chores.menu.new")}
                </Button>
              </div>
            ) : (
              <>
                <SearchField
                  label={t("chores.search.label")}
                  placeholder={t("chores.search.label")}
                  clearLabel={t("chores.search.clear")}
                  value={query}
                  onValueChange={setQuery}
                />
                {/* The strip scrolls sideways: pt-BR's long Category names do not fit one row. */}
                <div
                  role="group"
                  aria-label={t("chores.filter.label")}
                  className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
                >
                  <button
                    type="button"
                    aria-pressed={chip === null}
                    onClick={() => setChip(null)}
                    className={CHIP}
                  >
                    {t("chores.filter.all")}
                  </button>
                  {chipIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={chip === id}
                      onClick={() => setChip(chip === id ? null : id)}
                      className={CHIP}
                    >
                      <ChoreIcon size="sm" category={choreCategory(id)} />
                      {labelText(t, categoryLabel(id))}
                    </button>
                  ))}
                </div>

                {groups.length === 0 && (
                  <EmptyState
                    kind="no-results"
                    icon={SearchX}
                    title={t("chores.noResults.title")}
                    message={t("chores.noResults.message")}
                    action={{
                      label: t("chores.noResults.clear"),
                      onClick: clearFilters,
                    }}
                  />
                )}

                {groups.map((group) => (
                  <section
                    key={group.category}
                    aria-labelledby={`chores-${group.category}`}
                    className="mt-0 flex flex-col gap-2"
                  >
                    <h2
                      id={`chores-${group.category}`}
                      className="my-0 text-sm font-medium text-muted"
                    >
                      {labelText(t, categoryLabel(group.category))} ·{" "}
                      {group.chores.length}
                    </h2>
                    <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border/40 bg-surface p-0">
                      {group.chores.map((chore: Chore) => (
                        <ChoreItem
                          key={chore.id}
                          chore={chore}
                          onOpen={() =>
                            setEditing({ kind: "edit", id: chore.id })
                          }
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}

            {editing.kind === "new" && (
              <ChoreForm
                inDialog
                initial={emptyForm()}
                mode="create"
                idKey="new"
                categories={state.categories}
                demands={state.demands}
                save={createChore}
                responsible={responsibleFor(null)}
                onSaved={onSaved}
                onCancel={close}
              />
            )}

            {(editing.kind === "catalog" || editing.kind === "fromCatalog") && (
              <CatalogPicker
                onPick={(entry) => setEditing({ kind: "fromCatalog", entry })}
                onClose={close}
              />
            )}

            {editing.kind === "fromCatalog" && (
              <ChoreForm
                inDialog
                initial={formFromEntry(editing.entry, t)}
                mode="create"
                idKey={`catalog-${editing.entry.id}`}
                categories={state.categories}
                demands={state.demands}
                save={createChore}
                responsible={responsibleFor(null)}
                onSaved={onSaved}
                onCancel={() => setEditing({ kind: "catalog" })}
              />
            )}

            {editedChore && (
              <ChoreForm
                key={editedChore.id}
                inDialog
                initial={formFromChore(editedChore)}
                mode="edit"
                idKey={editedChore.id}
                categories={state.categories}
                demands={state.demands}
                save={(input) => updateChore(editedChore.id, input)}
                responsible={responsibleFor(editedChore)}
                onSaved={onSaved}
                onCancel={close}
                onDelete={() => {
                  destroy(editedChore);
                  close();
                  focusHeading();
                }}
              />
            )}
          </>
        )}
      </TabBody>
    </section>
  );
}
