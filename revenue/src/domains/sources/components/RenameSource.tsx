import { Button, Sheet } from "@homeowner/bedrock";
import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Source } from "../api";
import { SourceNameForm } from "./SourceNameForm";

/** Opens the rename form in a Sheet from `trigger` (a whole row) or, by default, an edit icon at the end of a Source's row; focus comes back to it. */
export function RenameSource({ source, trigger }: { source: Source; trigger?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t("sources.name.editFor", { name: source.name });
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={trigger ?? <Button variant="ghost" icon={Pencil}><span className="sr-only">{label}</span></Button>}
      title={label}
      closeLabel={t("app.close")}
    >
      <SourceNameForm source={source} onDone={() => setOpen(false)} />
    </Sheet>
  );
}
