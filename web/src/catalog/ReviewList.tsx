import { useEffect, useRef, useState, type RefObject } from "react";
import type { FieldCodes } from "../home/api";
import { CardRow } from "../shared/ui/CardRow";
import { ChoreForm } from "../chores/ChoreForm";
import { choreFieldErrorKey } from "../chores/fieldErrors";
import { choreFacts } from "../chores/facts";
import { useChoreLists } from "../chores/useChoreLists";
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
 * The suggested Chores for review: each can be edited with the normal Chore form or removed after a second
 * tap. Edits are local until the parent saves the Home. An empty list is allowed.
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

      <ul className="p-0">
        {items.map((item) => {
          const itemErrors = errors[item.key] ?? {};
          const name = nameOf(item);

          if (editing === item.key && lists.state.kind === "ready") {
            return (
              <li key={item.key} className="list-none ps-0">
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

/** One suggested Chore: its facts, the API's refusals, and the edit and two-step remove actions. */
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
  const { t, locale } = useI18n();
  const hasErrors = Object.keys(itemErrors).length > 0;

  const actions = !removing && (
    <>
      <Button
        variant="secondary"
        disabled={disabled || !canEdit}
        aria-label={t("chores.item.edit.label", { name })}
        onClick={onEdit}
      >
        {t("catalog.review.edit")}
      </Button>
      <Button
        variant="secondary"
        disabled={disabled}
        aria-label={t("catalog.review.remove.label", { name })}
        ref={(node) => {
          if (node) removeButtons.current.set(item.key, node);
          else removeButtons.current.delete(item.key);
        }}
        onClick={onRemove}
      >
        {t("catalog.review.remove")}
      </Button>
    </>
  );

  return (
    <li className="list-none ps-0">
      <CardRow actions={actions} className="mb-3">
        <h3 className="mt-0 font-semibold">{name}</h3>
        <p className="text-muted">{choreFacts(previewOf(item), t, locale).join(" · ")}</p>
        {hasErrors && (
          <div role="alert" className="text-danger">
            <p>{t("catalog.review.item.invalid")}</p>
            <ul>
              {Object.entries(itemErrors).map(([field, code]) => (
                <li key={field}>{t(choreFieldErrorKey(field, code))}</li>
              ))}
            </ul>
          </div>
        )}

        {removing && (
          <div role="group" aria-label={t("catalog.review.remove.label", { name })}>
            <p>{t("catalog.review.remove.prompt", { name })}</p>
            <div className="flex flex-wrap gap-3">
              <Button ref={keepRef} variant="secondary" onClick={onKeep}>
                {t("catalog.review.remove.cancel")}
              </Button>
              <Button variant="danger" onClick={onConfirmRemove}>
                {t("catalog.review.remove.confirm")}
              </Button>
            </div>
          </div>
        )}
      </CardRow>
    </li>
  );
}
