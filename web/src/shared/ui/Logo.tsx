interface Props {
  /** The element that holds the logo: the page's `h1` (the default), or a `span` where it is not the heading. */
  as?: "h1" | "span";
}

/**
 * The Homeowner logo: a house drawn in one line with a check as its door, then the lowercase wordmark in Nunito
 * 800. The drawing is decoration (`aria-hidden`), so the accessible name is the visible text, "homeowner", and an
 * `aria-label` is never added. The house takes the text colour; the check takes the `accent` token, so both follow the
 * theme by token swap. This is the one place `accent` is decoration (DESIGN.md, The One Voice Rule). In
 * forced-colors mode both use the system text colour, so the logo never vanishes. The wordmark is a brand name and
 * is not translated.
 */
export function Logo({ as: Element = "h1" }: Props) {
  return (
    // The wordmark never breaks inside the word; where even it does not fit (the largest text on a narrow phone)
    // the drawing and the word wrap onto two lines instead.
    <Element className="m-0 inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-2 text-xl leading-none font-extrabold text-text">
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        width="28"
        height="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-7 shrink-0"
      >
        <path d="M4 15 L16 4 L28 15 M7.5 12.5 V27 H24.5 V12.5" />
        <path d="M12 19.5 L15 22.5 L20.5 16" className="text-accent forced-colors:text-[CanvasText]" />
      </svg>
      <span className="whitespace-nowrap">homeowner</span>
    </Element>
  );
}
