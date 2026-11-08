import * as Menu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useRef } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";

// Native HTML has no accessible menu button, so Radix gives the arrow keys, Escape and focus return (ADR 0007).
const ITEM =
  "flex min-h-11 cursor-pointer items-center rounded-control px-3 text-text outline-none data-[highlighted]:bg-surface data-[highlighted]:underline";

/**
 * The "⋯" button of a Bill: Edit and Delete behind it. Delete only asks to be confirmed; the dialog is the caller's.
 * Each action hands over the button, as the item it was picked from is gone once the dialog closes.
 */
export function BillMenu({
  name,
  disabled,
  onEdit,
  onDelete,
}: {
  name: string;
  disabled: boolean;
  onEdit(opener: HTMLElement | null): void;
  onDelete(opener: HTMLElement | null): void;
}) {
  const { t } = useI18n();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button ref={trigger} variant="ghost" icon disabled={disabled} aria-label={t("finances.bills.menu.label", { name })}>
          <Ellipsis aria-hidden="true" size={20} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-card border border-border bg-surface-raised p-1 text-text">
          <Menu.Item className={ITEM} onSelect={() => onEdit(trigger.current)}>
            {t("finances.bills.edit")}
          </Menu.Item>
          <Menu.Item className={ITEM} onSelect={() => onDelete(trigger.current)}>
            {t("finances.bills.delete")}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
