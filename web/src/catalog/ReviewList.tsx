import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { FieldCodes } from "../home/api";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { Card } from "../shared/ui/Card";
import { GroupHeading } from "../shared/ui/GroupHeading";
import { ChoreFacts } from "../chores/ChoreFacts";
import { ChoreForm } from "../chores/ChoreForm";
import { CategoryTile } from "../chores/FactList";
import { choreFieldErrorKey } from "../chores/fieldErrors";
import { groupByCategory } from "../chores/groups";
import { useChoreLists } from "../chores/useChoreLists";
import { categoryLabel, labelText } from "../profile/labels";
import { useToast } from "../shared/ui/useToast";
import { useI18n } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { keepLocally, previewOf, type ReviewItem } from "./review";

interface Props {
  /** The suggested Chores, in the order they will be created. */
  items: readonly ReviewItem[];
  /** The API's refusals for each item, keyed by `ReviewItem.key`. */
  errors: Readonly<Record<number, FieldCodes>>;
  /** The list is longer than one request can carry. */
  tooMany: boolean;
  onChange(items: ReviewItem[]): void;
  disabled: boolean;
}

/**
 * The suggested Chores for review, grouped by Category and drawn like the Chores tab's cards: each can be edited
 * with the normal Chore form or removed after a second tap. Edits are local until the parent saves the Home. An
 * empty list is allowed.
 */
export function ReviewList({ items, errors, tooMany, onChange, disabled }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const lists = useChoreLists();
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<number, HTMLButtonElement>());

  // Step two of a removal lands on the safe choice.
  useEffect(() => {
    if (removing !== null) keepRef.current?.focus();
  }, [removing]);

  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  const nameOf = (item: ReviewItem) => item.form.name || t("chores.form.create.heading");
  const categories = lists.state.kind === "ready" ? lists.state.categories : [];
  const groups = groupByCategory(
    items.map((item) => ({ item, category: item.form.category })),
    categories,
  );

  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading" ref={headingRef} tabIndex={-1}>
        {t("catalog.review.heading")}
      </h2>
      <p>{t("catalog.review.count", { count: items.length })}</p>

      {tooMany && (
        <p role="alert" className="text-danger">
          {t("catalog.review.tooMany")}
        </p>
      )}

      {items.length === 0 && <p>{t("catalog.review.empty")}</p>}

      {lists.state.kind === "loading" && items.length > 0 && <p role="status">{t("catalog.review.lists.loading")}</p>}
      {lists.state.kind === "failed" && items.length > 0 && (
        <>
          <p role="alert" className="text-danger">
            {t("catalog.review.lists.error")}
          </p>
          <Button variant="secondary" onClick={lists.reload}>
            {t("chores.retry")}
          </Button>
        </>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`review-${group.category}`} className="mt-0">
            <GroupHeading count={group.chores.length} icon={<CategoryTile category={group.category} />}>
              <span id={`review-${group.category}`}>{labelText(t, categoryLabel(group.category))}</span>
            </GroupHeading>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {group.chores.map(({ item }) => {
                const itemErrors = errors[item.key] ?? {};
                const name = nameOf(item);

                if (editing === item.key && lists.state.kind === "ready") {
                  return (
                    <li key={item.key} className="my-0 list-none">
                      <ChoreForm
                        initial={item.form}
                        mode="edit"
                        idKey={`review-${item.key}`}
                        categories={lists.state.categories}
                        demands={lists.state.demands}
                        initialErrors={itemErrors}
                        save={(input) => Promise.resolve(keepLocally(String(item.key), input))}
                        onSaved={(_chore, values) => {
                          onChange(items.map((other) => (other.key === item.key ? { ...other, form: values } : other)));
                          setEditing(null);
                          toast.show({ messageKey: "catalog.review.edited", params: { name: values.name }, tone: "success" });
                          focusHeading();
                        }}
                        onCancel={() => {
                          setEditing(null);
                          focusHeading();
                        }}
                      />
                    </li>
                  );
                }

                return (
                  <ReviewRow
                    key={item.key}
                    item={item}
                    name={name}
                    itemErrors={itemErrors}
                    removing={removing === item.key}
                    disabled={disabled}
                    canEdit={lists.state.kind === "ready"}
                    keepRef={keepRef}
                    removeButtons={removeButtons}
                    onEdit={() => setEditing(item.key)}
                    onRemove={() => setRemoving(item.key)}
                    onKeep={() => {
                      setRemoving(null);
                      // The button is mounted again by the time the browser handles this.
                      requestAnimationFrame(() => removeButtons.current.get(item.key)?.focus());
                    }}
                    onConfirmRemove={() => {
                      onChange(items.filter((other) => other.key !== item.key));
                      setRemoving(null);
                      setEditing((current) => (current === item.key ? null : current));
                      toast.show({ messageKey: "catalog.review.removed", params: { name }, tone: "success" });
                      focusHeading();
                    }}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

interface RowProps {
  item: ReviewItem;
  name: string;
  itemErrors: FieldCodes;
  /** This row is asking for the second tap that confirms its removal. */
  removing: boolean;
  disabled: boolean;
  /** The Category and Demand lists are loaded, so the edit form can open. */
  canEdit: boolean;
  keepRef: RefObject<HTMLButtonElement | null>;
  removeButtons: RefObject<Map<number, HTMLButtonElement>>;
  onEdit(): void;
  onRemove(): void;
  onKeep(): void;
  onConfirmRemove(): void;
}

/** One suggested Chore, as on the Chores tab: its name with Edit and a two-step Remove, its facts, and the API's refusals. */
function ReviewRow({
  item,
  name,
  itemErrors,
  removing,
  disabled,
  canEdit,
  keepRef,
  removeButtons,
  onEdit,
  onRemove,
  onKeep,
  onConfirmRemove,
}: RowProps) {
  const { t } = useI18n();
  const hasErrors = Object.keys(itemErrors).length > 0;

  return (
    <li className="my-0 list-none">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h4 className="my-0 min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{name}</h4>
          {!removing && (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                icon
                disabled={disabled || !canEdit}
                aria-label={t("chores.item.edit.label", { name })}
                onClick={onEdit}
              >
                <Pencil size={20} aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                icon
                disabled={disabled}
                aria-label={t("catalog.review.remove.label", { name })}
                ref={(node) => {
                  if (node) removeButtons.current.set(item.key, node);
                  else removeButtons.current.delete(item.key);
                }}
                onClick={onRemove}
              >
                <Trash2 size={20} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <ChoreFacts chore={previewOf(item)} />

        {hasErrors && (
          <div role="alert" className="text-danger">
            <p className="my-0 font-semibold">{t("catalog.review.item.invalid")}</p>
            <ul className="my-1">
              {Object.entries(itemErrors).map(([field, code]) => (
                <li key={field}>{t(choreFieldErrorKey(field, code))}</li>
              ))}
            </ul>
          </div>
        )}

        {removing && (
          <div
            role="group"
            aria-label={t("catalog.review.remove.label", { name })}
            className="flex flex-col gap-2 border-t border-border/40 pt-3"
          >
            <p className="my-0">{t("catalog.review.remove.prompt", { name })}</p>
            <ButtonRow className="justify-end">
              <Button ref={keepRef} variant="secondary" onClick={onKeep}>
                {t("catalog.review.remove.cancel")}
              </Button>
              <Button variant="danger" onClick={onConfirmRemove}>
                {t("catalog.review.remove.confirm")}
              </Button>
            </ButtonRow>
          </div>
        )}
      </Card>
    </li>
  );
}
