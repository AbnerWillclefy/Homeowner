import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

type ToastProviderProps = {
  /** Required: names the notifications region for screen readers (Radix defaults to English). */
  label: string;
  /** Lets an app lift the viewport above its BottomBar. */
  viewportClassName?: string;
  children: ReactNode;
};

/** Wrap the app once; renders the viewport the toasts appear in. */
export function ToastProvider({ label, viewportClassName, children }: ToastProviderProps) {
  return (
    <ToastPrimitive.Provider label={label}>
      {children}
      <ToastPrimitive.Viewport
        label={label}
        className={cn(
          "fixed bottom-[calc(var(--space-16)+env(safe-area-inset-bottom))] left-1/2 z-(--z-toast) flex w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 flex-col gap-2 outline-none tablet:right-4 tablet:left-auto tablet:translate-x-0",
          viewportClassName,
        )}
      />
    </ToastPrimitive.Provider>
  );
}

type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tone is carried by the icon and the title text as well as the colour. */
  tone: "neutral" | "positive" | "danger";
  title: string;
  description?: string;
  /** Required: the accessible name of the close button. */
  closeLabel: string;
  /** altText tells screen-reader users how to do the action without reaching the toast. */
  action?: { label: string; altText: string; onClick: () => void };
};

const icons = {
  positive: <CircleCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden />,
  danger: <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />,
  neutral: null,
};

export function Toast({ open, onOpenChange, tone, title, description, closeLabel, action }: ToastProps) {
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      // Danger interrupts the screen reader (assertive); the others wait their turn (polite).
      type={tone === "danger" ? "foreground" : "background"}
      // A toast with an action never times out: WCAG 2.2.1 Timing Adjustable, because a keyboard
      // or screen-reader Resident must be able to reach "Desfazer". It closes on the action,
      // the close button, Escape or a swipe. Radix pauses the 5s timer on hover and focus.
      duration={action ? Infinity : 5000}
      className="br-toast flex min-h-control-lg items-start gap-2 rounded-md border border-border bg-surface-raised p-2 shadow-(--shadow-overlay) duration-(--duration-base) motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:slide-in-from-bottom-2 motion-safe:data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)"
    >
      {icons[tone]}
      <div className="flex min-w-0 flex-1 flex-col self-center">
        <ToastPrimitive.Title className="body-strong text-text">{title}</ToastPrimitive.Title>
        {description && <ToastPrimitive.Description className="body text-text-muted">{description}</ToastPrimitive.Description>}
      </div>
      {action && (
        <ToastPrimitive.Action asChild altText={action.altText}>
          <Button variant="ghost" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </ToastPrimitive.Action>
      )}
      <ToastPrimitive.Close asChild>
        <Button variant="ghost" size="sm" aria-label={closeLabel}>
          <X className="size-4" aria-hidden />
        </Button>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export type { ToastProps, ToastProviderProps };
