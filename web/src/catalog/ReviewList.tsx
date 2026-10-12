import { useEffect, useRef, useState } from "react";
import type { FieldCodes } from "../api/home";
import { CardRow } from "../components/ui/CardRow";
import { PillButton } from "../components/ui/PillButton";
import { ChoreForm } from "../chores/ChoreForm";
import { choreFieldErrorKey } from "../chores/fieldErrors";
import { choreFacts } from "../chores/facts";
import { useChoreLists } from "../chores/useChoreLists";
import { useToast } from "../components/ui/useToast";
import { useI18n } from "../i18n";
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
  const { t, locale } = useI18n();
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
          <PillButton variant="secondary" onClick={lists.reload}>
            {t("chores.retry")}
          </PillButton>
        </>
      )}

      <ul className="p-0">
        {items.map((item) => {
          const itemErrors = errors[item.key] ?? {};
          const hasErrors = Object.keys(itemErrors).length > 0;
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

          const actions = removing !== item.key && (
            <>
              <PillButton
                variant="secondary"
                disabled={disabled || lists.state.kind !== "ready"}
                aria-label={t("chores.item.edit.label", { name })}
                onClick={() => setEditing(item.key)}
              >
                {t("catalog.review.edit")}
              </PillButton>
              <PillButton
                variant="secondary"
                disabled={disabled}
                aria-label={t("catalog.review.remove.label", { name })}
                ref={(node) => {
                  if (node) removeButtons.current.set(item.key, node);
                  else removeButtons.current.delete(item.key);
                }}
                onClick={() => setRemoving(item.key)}
              >
                {t("catalog.review.remove")}
              </PillButton>
            </>
          );

          return (
            <li key={item.key} className="list-none ps-0">
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

                {removing === item.key && (
                  <div role="group" aria-label={t("catalog.review.remove.label", { name })}>
                    <p>{t("catalog.review.remove.prompt", { name })}</p>
                    <div className="flex flex-wrap gap-3">
                      <PillButton
                        ref={keepRef}
                        variant="secondary"
                        onClick={() => {
                          setRemoving(null);
                          // The button is mounted again by the time the browser handles this.
                          requestAnimationFrame(() => removeButtons.current.get(item.key)?.focus());
                        }}
                      >
                        {t("catalog.review.remove.cancel")}
                      </PillButton>
                      <PillButton
                        variant="danger"
                        onClick={() => {
                          onChange(items.filter((other) => other.key !== item.key));
                          setRemoving(null);
                          setEditing((current) => (current === item.key ? null : current));
                          toast.show({ messageKey: "catalog.review.removed", params: { name }, tone: "success" });
                          focusHeading();
                        }}
                      >
                        {t("catalog.review.remove.confirm")}
                      </PillButton>
                    </div>
                  </div>
                )}
              </CardRow>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
