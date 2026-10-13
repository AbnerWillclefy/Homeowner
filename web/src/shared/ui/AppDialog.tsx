import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode, type RefObject } from "react";

interface Props {
  /** Escape and a tap outside call this, like the screen's own dismiss button. */
  onDismiss(): void;
  /** False while a request is in flight: Escape and a tap outside then do nothing. */
  dismissible?: boolean;
  /** Every state of a dialog has a title, or screen readers get an unnamed dialog. */
  title: ReactNode;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** Described by this text, or by nothing (then it is left out on purpose). */
  description?: ReactNode;
  /** A control that opens the dialog. Radix returns focus to it on close. */
  trigger?: ReactNode;
  /** Whether the dialog is showing. Without a trigger it is open for as long as it is rendered. */
  open?: boolean;
  /** Where focus lands on opening instead of the title, for example Cancel on a destructive action. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * "centered" (default) is a short dialog in the middle. "sheet" is near full height for forms. Either way the
   * body scrolls and `footer` stays pinned below it.
   */
  size?: "centered" | "sheet";
  /** Actions pinned below the scrolling body, so they stay reachable with the keyboard open. */
  footer?: ReactNode;
  children: ReactNode;
}

// Whole class strings, so Tailwind finds them. `dvh` follows the mobile browser chrome and on-screen keyboard.
const CONTENT_BASE =
  "fixed mx-auto flex max-w-[32rem] flex-col rounded-lg border border-border bg-surface-raised text-text";
const CONTENT_SIZE = {
  centered: "inset-x-4 top-1/2 max-h-[90dvh] -translate-y-1/2",
  sheet: "inset-x-2 top-[4dvh] h-[92dvh]",
} as const;
const BODY_SIZE = { centered: "p-6", sheet: "p-4" } as const;

/**
 * A modal dialog over the screen behind it (Radix supplies the focus trap, Escape and the inert background).
 * Focus lands on the title so the dialog is announced; when it goes away, focus returns to where it was, or to
 * the page if that element is gone, so keyboard and screen reader users are never left on nothing.
 */
export function AppDialog({
  onDismiss,
  dismissible = true,
  title,
  titleRef,
  description,
  trigger,
  open = true,
  initialFocusRef,
  size = "centered",
  footer,
  children,
}: Props) {
  const ownTitleRef = useRef<HTMLHeadingElement>(null);
  const heading = titleRef ?? ownTitleRef;
  const before = useRef<Element | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onDismiss()}>
      {trigger !== undefined && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/50" />
        <Dialog.Content
          className={`${CONTENT_BASE} ${CONTENT_SIZE[size]}`}
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            before.current = document.activeElement;
            (initialFocusRef ?? heading).current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (trigger !== undefined) return;
            event.preventDefault();
            const previous = before.current;
            if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected) previous.focus();
            // A dialog stacked on another may close after it, so only catch focus that has nowhere to be.
            else if (document.activeElement === null || document.activeElement === document.body)
              document.querySelector<HTMLElement>("main")?.focus();
          }}
          onEscapeKeyDown={(event) => !dismissible && event.preventDefault()}
          onInteractOutside={(event) => !dismissible && event.preventDefault()}
        >
          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${BODY_SIZE[size]}`}>
            <Dialog.Title ref={heading} tabIndex={-1}>
              {title}
            </Dialog.Title>
            {description !== undefined && (
              <Dialog.Description asChild>
                <div>{description}</div>
              </Dialog.Description>
            )}
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
