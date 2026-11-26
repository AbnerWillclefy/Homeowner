import { Row, Sheet } from "@homeowner/bedrock";
import { ChevronRight } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";

/**
 * One row of a Bedrock `List` that opens a Sheet with `children`: the whole row is the button, with a chevron.
 * The Sheet's body mounts only while it is open. Focus goes back to the row when the Sheet closes.
 */
export function SheetRow({
  icon,
  title,
  caption,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** The row's second line: the current value. Also read as part of the row's name. */
  caption?: string;
  /** The Sheet's line under its title. */
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Row
        asChild
        className="my-0"
        leading={icon}
        title={title}
        caption={caption}
        trailing={<ChevronRight size={20} aria-hidden="true" className="text-muted" />}
      >
        <button ref={opener} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} />
      </Row>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) requestAnimationFrame(() => opener.current?.focus());
        }}
        title={title}
        subtitle={subtitle}
        closeLabel={t("me.sheet.close")}
      >
        {open && children}
      </Sheet>
    </>
  );
}
