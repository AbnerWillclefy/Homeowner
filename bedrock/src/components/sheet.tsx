import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode, RefObject } from "react";
import { Drawer } from "vaul";
import { useMediaQuery } from "../lib/use-media-query";
import { Button } from "./button";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus returns to it on close. */
  trigger?: ReactNode;
  /** For a Sheet opened without `trigger`: focus returns to this element on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
  subtitle?: string;
  /** Read by screen readers on the close button. */
  closeLabel: string;
  children: ReactNode;
  /** The primary action, pinned to the bottom and full width. */
  footer?: ReactNode;
  /** Drawn before the title block (a large icon). */
  leading?: ReactNode;
  /** Drawn before the close button (a ⋯ `Menu`). */
  tools?: ReactNode;
  /** False while a write is in flight: no drag, no Escape, no tap outside, and the close button is disabled. Default true. */
  dismissible?: boolean;
  /** False draws no ✕: a footer button is the way out. Escape and drag still close it. Default true. */
  closeButton?: boolean;
  /** `full` is 92% of a phone's height; `auto` is the content's height, up to 90%. Default `auto`. */
  size?: "auto" | "full";
};

const overlay = "fixed inset-0 z-(--z-overlay) bg-scrim";
const content = "fixed z-(--z-overlay) flex flex-col bg-surface-raised text-text shadow-(--shadow-overlay) outline-none";

/**
 * A side panel from the tablet breakpoint up, a bottom drawer below it.
 * Crossing the breakpoint while open swaps the tree, so focus restarts in the new one.
 */
export function Sheet({ open, onOpenChange, trigger, returnFocusRef, title, subtitle, closeLabel, children, footer, leading, tools, dismissible = true, closeButton = true, size = "auto" }: SheetProps) {
  // Duplicates --bp-tablet in tokens.css: matchMedia cannot read custom properties.
  const wide = useMediaQuery("(min-width: 768px)");
  const T = wide ? DialogPrimitive : Drawer;
  // vaul slides the drawer with a keyframe animation and ignores reduced motion, so motion-reduce:animate-none! stops it (WCAG 2.3.3).
  const panel = wide
    ? "inset-y-0 right-0 w-panel max-w-full rounded-l-xl motion-safe:duration-(--duration-slow) motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right motion-safe:data-[state=open]:ease-standard motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-right motion-safe:data-[state=closed]:ease-exit"
    : `inset-x-0 bottom-0 ${size === "full" ? "h-[92dvh] max-h-[92dvh]" : "max-h-[90dvh]"} rounded-t-xl motion-reduce:transition-none! motion-reduce:animate-none!`;
  const keep = dismissible ? {} : { onEscapeKeyDown: (event: Event) => event.preventDefault(), onInteractOutside: (event: Event) => event.preventDefault() };

  return (
    <T.Root open={open} onOpenChange={onOpenChange} {...(wide ? {} : { dismissible })}>
      {trigger && <T.Trigger asChild>{trigger}</T.Trigger>}
      <T.Portal>
        <T.Overlay data-slot="scrim" className={overlay} />
        <T.Content data-slot="sheet" className={`${content} ${panel}`}
          onCloseAutoFocus={(event: Event) => {
            if (!returnFocusRef) return;
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          {...keep}
          {...(subtitle ? {} : { "aria-describedby": undefined })}>
          {!wide && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />}
          <header className="flex items-start justify-between gap-4 p-6 pb-2">
            {leading}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <T.Title className="section-title">{title}</T.Title>
              {subtitle && <T.Description className="body text-text-muted">{subtitle}</T.Description>}
            </div>
            {tools}
            {closeButton && (
              <T.Close asChild>
                <Button variant="ghost" size="sm" disabled={!dismissible}>
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">{closeLabel}</span>
                </Button>
              </T.Close>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
          {footer && <footer className="flex flex-col gap-2 p-6 pt-2">{footer}</footer>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export type { SheetProps };
