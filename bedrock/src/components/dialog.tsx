import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus returns to it on close. */
  trigger?: ReactNode;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** An extra body between the description and the actions. */
  children?: ReactNode;
};

/** A destructive confirmation: Escape cancels, an overlay click does not, Cancel has the first focus. */
export function Dialog({ open, onOpenChange, trigger, title, description, cancelLabel, confirmLabel, onConfirm, children }: DialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-(--z-overlay) flex w-[min(440px,100%)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface-raised p-6 text-text shadow-(--shadow-overlay) motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95">
          <AlertDialog.Title className="section-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="body text-text-muted">{description}</AlertDialog.Description>
          {children}
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export type { DialogProps };
