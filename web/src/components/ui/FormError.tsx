import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { formErrorId } from "./formErrorId";

interface Props {
  /** The form's name; its message gets the id `formErrorId(form)`, which fields point `aria-describedby` at. */
  form: string;
  /** The message, or nothing when there is no problem. */
  children?: ReactNode;
}

/**
 * Where a form's problem is announced. The live region is always in the page (empty when all is well) so a
 * screen reader reliably speaks what is put into it, and focus stays on the field being edited. The icon and
 * the words carry the meaning, not the colour alone.
 */
export function FormError({ form, children }: Props) {
  return (
    <div role="alert">
      {children && (
        <p id={formErrorId(form)} className="mt-4 flex items-start gap-2 font-semibold text-danger">
          <TriangleAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span>{children}</span>
        </p>
      )}
    </div>
  );
}

/** A calm confirmation after a form action, in an always-present polite live region like FormError's. */
export function FormNotice({ children }: { children?: ReactNode }) {
  return <div role="status">{children && <p className="mt-4 font-semibold">{children}</p>}</div>;
}
