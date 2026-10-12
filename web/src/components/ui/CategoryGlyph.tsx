import { categoryStyle } from "./categoryStyle";

interface Props {
  /** A Category id; an unknown, empty or missing id shows the "Other" icon. */
  category?: string | null;
  className?: string;
}

/**
 * The Category icon in a circle, in the ink of the surface it sits on (place it inside a `Card` with the same
 * category). Decoration only: hidden from screen readers, not focusable and with no button styling, so the
 * Category name must be written next to it as text.
 */
export function CategoryGlyph({ category, className = "" }: Props) {
  const { icon: Icon } = categoryStyle(category);
  return (
    <span
      aria-hidden="true"
      className={`flex size-14 shrink-0 items-center justify-center rounded-pill border-2 border-current ${className}`}
    >
      <Icon size={28} />
    </span>
  );
}
