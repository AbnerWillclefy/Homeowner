import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement } from "react";

type TooltipProps = {
  /** One short line. It describes the trigger; the trigger keeps its own accessible name. */
  label: string;
  /**
   * The element that opens it. A disabled control cannot take focus, so a tooltip on one
   * never shows to keyboard users.
   */
  children: ReactElement;
  /** Extra classes for the bubble, such as `wide:hidden`. */
  className?: string;
};

/**
 * A visual aid for icon-only controls. While open, Radix sets aria-describedby on the trigger,
 * so a screen reader may hear the label twice; that is acceptable.
 */
export function Tooltip({ label, children, className = "" }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={4}
            className={`br-tooltip label z-(--z-tooltip) max-w-60 rounded-md bg-text px-2 py-1 text-bg shadow-(--shadow-overlay) ${className}`}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export type { TooltipProps };
