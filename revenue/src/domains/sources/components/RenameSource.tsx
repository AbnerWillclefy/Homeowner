import { Button, Sheet } from "@homeowner/bedrock";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Source } from "../api";
import { SourceNameForm } from "./SourceNameForm";

/** The edit icon at the end of a Source's row; it opens the rename form in a Sheet and focus comes back to the icon. */
export function RenameSource({ source }: { source: Source }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t("sources.name.editFor", { name: source.name });
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost" icon={Pencil}><span className="sr-only">{label}</span></Button>}
      title={label}
      closeLabel={t("app.close")}
    >
      <SourceNameForm source={source} onDone={() => setOpen(false)} />
    </Sheet>
  );
}
