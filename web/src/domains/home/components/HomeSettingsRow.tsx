import { Row, Select, Sheet } from "@homeowner/bedrock";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { RowTile } from "../../../shared/ui/RowTile";
import { useUndoable } from "../../../shared/undo/useUndoable";
import { updateHome, type Home, type HomeSettings } from "../api/api";
import { browserTimezones } from "../logic/browserTimezones";
import { settingsChange } from "../logic/settingsChange";
import { timezoneOptions } from "../logic/timezones";
import { AllocationTimePicker } from "./AllocationTimePicker";

interface Props {
  home: Home;
  /** Puts a Home in the cache: the new value at once, the server's answer, or the old value back. */
  onShow(home: Home): void;
}

/**
 * The "Ajustes do lar" Row of the Home tab; it opens a Sheet with the two settings. There is no Save: choosing a value
 * closes the Sheet, sends `PUT /home` at once and a Toast offers Desfazer, which writes the old settings back (`undoableChange`). A
 * refused or failed write puts the old value back and the Toast says why. Any Resident can change them.
 */
export function HomeSettingsRow({ home, onShow }: Props) {
  const { t } = useI18n();
  const { undoableChange } = useUndoable();
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const zones = useMemo(() => timezoneOptions(browserTimezones(), home.timezone).map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })), [home.timezone]);

  const change = (field: keyof HomeSettings) => (value: string) => {
    if (value === home[field]) return;
    // The Sheet is modal, so its Toast could not be reached while it stays open: it closes, and the Toast offers Desfazer.
    setOpen(false);
    void undoableChange(settingsChange(home, field, value, { update: updateHome, show: onShow }));
  };

  return (
    <>
      <Row
        asChild
        className="my-0"
        leading={<RowTile icon={SlidersHorizontal} />}
        title={t("home.settings.card.title")}
        caption={t("home.settings.card.hint")}
        trailing={<ChevronRight size={20} aria-hidden="true" className="text-muted" />}
      >
        <button ref={openerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} />
      </Row>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("home.settings.card.title")}
        returnFocusRef={openerRef}
        closeLabel={t("home.settings.sheet.close")}
      >
        <div className="flex flex-col gap-4 pb-4">
          <AllocationTimePicker label={t("home.allocationTime.label")} value={home.allocationTime} onChange={change("allocationTime")} hint={t("home.allocationTime.hint")} />
          <Select label={t("home.timezone.label")} options={zones} value={home.timezone} onValueChange={change("timezone")} />
        </div>
      </Sheet>
    </>
  );
}
