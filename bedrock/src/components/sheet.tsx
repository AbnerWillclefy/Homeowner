import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { useMediaQuery } from "../lib/use-media-query";
import { Button } from "./button";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus returns to it on close. */
  trigger?: ReactNode;
  title: string;
  subtitle?: string;
  /** Read by screen readers on the close button. */
  closeLabel: string;
  children: ReactNode;
  /** The primary action, pinned to the bottom and full width. */
  footer?: ReactNode;
};

const overlay = "fixed inset-0 z-(--z-overlay) bg-scrim";
const content = "fixed z-(--z-overlay) flex flex-col bg-surface-raised text-text shadow-(--shadow-overlay) outline-none";

/**
 * A side panel from the tablet breakpoint up, a bottom drawer below it.
 * Crossing the breakpoint while open swaps the tree, so focus restarts in the new one.
 */
export function Sheet({ open, onOpenChange, trigger, title, subtitle, closeLabel, children, footer }: SheetProps) {
  // Duplicates --bp-tablet in tokens.css: matchMedia cannot read custom properties.
  const wide = useMediaQuery("(min-width: 768px)");
  const T = wide ? DialogPrimitive : Drawer;
  // vaul's own transition: motion-reduce:transition-none! is there in case it ignores reduced motion.
  const panel = wide
    ? "inset-y-0 right-0 w-panel max-w-full rounded-l-xl motion-safe:duration-(--duration-slow) motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right motion-safe:data-[state=open]:ease-standard motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-right motion-safe:data-[state=closed]:ease-exit"
    : "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl motion-reduce:transition-none!";

  return (
    <T.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <T.Trigger asChild>{trigger}</T.Trigger>}
      <T.Portal>
        <T.Overlay className={overlay} />
        <T.Content className={`${content} ${panel}`} {...(subtitle ? {} : { "aria-describedby": undefined })}>
          {!wide && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />}
          <header className="flex items-start justify-between gap-4 p-6 pb-2">
            <div className="flex flex-col gap-1">
              <T.Title className="section-title">{title}</T.Title>
              {subtitle && <T.Description className="body text-text-muted">{subtitle}</T.Description>}
            </div>
            <T.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="size-4" aria-hidden />
                <span className="sr-only">{closeLabel}</span>
              </Button>
            </T.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
          {footer && <footer className="flex flex-col p-6 pt-2">{footer}</footer>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export type { SheetProps };
