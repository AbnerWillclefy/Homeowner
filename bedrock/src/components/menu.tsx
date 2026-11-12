import { Ellipsis, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { useMediaQuery } from "../lib/use-media-query";
import { Button } from "./button";
import { Sheet } from "./sheet";

type MenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean };

type MenuProps = {
  /** The trigger's accessible name, such as "Mais ações". Also the Sheet's title on a phone. */
  label: string;
  /** Read by screen readers on the Sheet's close button. */
  closeLabel: string;
  /** `danger` items are drawn last, after a separator. */
  items: MenuItem[];
};

// Exported so other dropdowns (Select) look the same.
export const menuContentClass =
  "br-menu z-(--z-popover) min-w-50 rounded-md border border-border bg-surface-raised p-1 text-text shadow-(--shadow-overlay)";
export const menuItemClass =
  "body flex h-control-md cursor-pointer items-center gap-2 rounded-sm px-2 outline-none data-[highlighted]:bg-surface-hover data-[disabled]:cursor-not-allowed data-[disabled]:opacity-(--opacity-disabled)";
const rowClass =
  "body flex h-control-lg w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)";

/**
 * Rare actions behind an icon button: a dropdown from the tablet breakpoint up,
 * the same items in the Sheet below it.
 */
export function Menu({ label, closeLabel, items }: MenuProps) {
  // Duplicates --bp-tablet in tokens.css: matchMedia cannot read custom properties.
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const normal = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  const separated = normal.length > 0 && danger.length > 0;

  const trigger = (
    <Button variant="ghost" size="sm">
      <Ellipsis className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </Button>
  );

  if (!wide) {
    const row = (item: MenuItem) => (
      <li key={item.label}>
        <button
          type="button"
          disabled={item.disabled}
          className={`${rowClass} ${item.danger ? "text-danger" : ""}`}
          onClick={() => {
            // Close first, so focus is back on the trigger before the action runs.
            setOpen(false);
            item.onSelect();
          }}
        >
          {item.icon && <item.icon className="size-4 shrink-0" aria-hidden />}
          {item.label}
        </button>
      </li>
    );
    return (
      <Sheet open={open} onOpenChange={setOpen} trigger={trigger} title={label} closeLabel={closeLabel}>
        <ul className="flex flex-col">
          {normal.map(row)}
          {/* A list may only hold li, so the rule is decorative and hidden. */}
          {separated && <li aria-hidden className="my-1 h-px bg-border" />}
          {danger.map(row)}
        </ul>
      </Sheet>
    );
  }

  const entry = (item: MenuItem) => (
    <DropdownMenu.Item
      key={item.label}
      disabled={item.disabled}
      onSelect={item.onSelect}
      className={`${menuItemClass} ${item.danger ? "text-danger" : ""}`}
    >
      {item.icon && <item.icon className="size-4 shrink-0" aria-hidden />}
      {item.label}
    </DropdownMenu.Item>
  );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContentClass}>
          {normal.map(entry)}
          {separated && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
          {danger.map(entry)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export type { MenuItem, MenuProps };
