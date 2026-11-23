import { Banner, Button, EmptyState, Input, Sheet, Skeleton } from "@homeowner/bedrock";
import { Camera, ClipboardPaste, Clock, CloudOff, QrCode, Receipt as ReceiptIcon, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useAddReceipt } from "../hooks/useAddReceipt";
import { MatchLine } from "./MatchLine";
import { PhotoDraft } from "./PhotoDraft";
import { QrScanner } from "./QrScanner";

/**
 * The "Adicionar nota" Sheet, opened by a button elsewhere (the page header's action), so it is controlled. A Sheet with no
 * trigger returns focus to nothing: the opener hands it back when `open` turns false. A write in flight keeps it open.
 */
export function AddReceiptSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  // The photo read cost a model call, so closing on the draft asks first.
  const close = () => !busy && (!drafting || window.confirm(t("receipt.discard")));
  return (
    <Sheet open={open} onOpenChange={(next) => (next || close()) && onOpenChange(next)} title={t("receipt.title")} closeLabel={t("app.close")}>
      {/* Mounted only while open, so each opening starts at "choose". */}
      <Flow onBusy={setBusy} onDrafting={setDrafting} onClose={() => onOpenChange(false)} />
    </Sheet>
  );
}

function Flow({ onBusy, onDrafting, onClose }: { onBusy(busy: boolean): void; onDrafting(drafting: boolean): void; onClose(): void }) {
  const { t } = useI18n();
  const { step, dispatch, submit, match, readFile, confirm } = useAddReceipt();
  const picker = useRef<HTMLInputElement>(null);
  // Kept here, not in the paste step, so a scanned code survives a failed read.
  const [code, setCode] = useState("");
  const [matching, setMatching] = useState(false);
  const busy = step.kind === "saving" || step.kind === "reading" || (step.kind === "draft" && step.saving) || matching;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    onDrafting(step.kind === "draft");
    return () => onDrafting(false);
  }, [step.kind, onDrafting]);
  const takePhoto = () => picker.current?.click();
  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same photo again still fires
    if (file) void readFile(file);
  };
  const read = (text: string) => {
    setCode(text);
    void submit(text.trim());
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    read(code);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <input ref={picker} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      {step.kind === "choose" && (
        <>
          <p className="body text-text-muted">{t("receipt.chooseText")}</p>
          <Button icon={QrCode} onClick={() => dispatch({ type: "scan" })}>{t("receipt.scan")}</Button>
          <Button variant="secondary" icon={ClipboardPaste} onClick={() => dispatch({ type: "paste" })}>{t("receipt.paste")}</Button>
          <Button variant="secondary" icon={Camera} onClick={takePhoto}>{t("receipt.photo")}</Button>
        </>
      )}

      {step.kind === "scan" && (
        <>
          <QrScanner onCode={read} onDenied={() => dispatch({ type: "denied" })} />
          <p className="body text-center text-text-muted">{t("receipt.aim")}</p>
          <Button variant="secondary" icon={ClipboardPaste} onClick={() => dispatch({ type: "paste" })}>{t("receipt.paste")}</Button>
        </>
      )}

      {step.kind === "paste" && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {step.notice === "denied" && <Banner tone="warning">{t("receipt.denied")}</Banner>}
          {step.notice === "failed" && <Banner tone="danger">{t("receipt.failed")}</Banner>}
          <Input
            label={t("receipt.keyLabel")}
            hint={t("receipt.keyHint")}
            error={step.notice === "invalid" ? t("receipt.invalid") : undefined}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000 0000 0000 …"
          />
          <Button type="submit" disabled={code.trim() === ""}>{t("receipt.fetch")}</Button>
          <Button variant="ghost" icon={ScanLine} onClick={() => dispatch({ type: "scan" })}>{t("receipt.scan")}</Button>
        </form>
      )}

      {step.kind === "saving" && (
        <div aria-busy="true" aria-label={t("receipt.loading")} className="flex flex-col gap-4">
          <p className="body text-text-muted">{t("receipt.loading")}</p>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {step.kind === "reading" && (
        <div aria-busy="true" aria-label={t("receipt.reading")} className="flex flex-col gap-4">
          <p className="body text-text-muted">{t("receipt.reading")}</p>
          <p className="caption text-text-muted">{t("receipt.readingHint")}</p>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {step.kind === "photoFailed" && (
        <>
          <Banner tone={step.reason === "cap" ? "warning" : "danger"} icon={step.reason === "cap" ? Clock : undefined}>
            {t(step.reason === "cap" ? "receipt.cap" : step.reason === "unreadable" ? "receipt.unreadable" : "receipt.photoFailed")}
          </Banner>
          {step.reason !== "cap" && <Button icon={Camera} onClick={takePhoto}>{t("receipt.photoAgain")}</Button>}
          <Button variant={step.reason === "cap" ? "primary" : "secondary"} icon={ClipboardPaste} onClick={() => dispatch({ type: "paste" })}>{t("receipt.paste")}</Button>
          {step.reason === "cap" && <Button variant="secondary" icon={QrCode} onClick={() => dispatch({ type: "scan" })}>{t("receipt.scan")}</Button>}
        </>
      )}

      {step.kind === "draft" && <PhotoDraft step={step} onSave={(draft) => void confirm(draft)} />}

      {step.kind === "matching" && <MatchLine step={step} match={match} onBusy={setMatching} />}

      {step.kind === "done" && (
        <>
          <EmptyState
            kind="done"
            icon={step.already ? ReceiptIcon : ScanLine}
            title={t(step.already ? "receipt.dupTitle" : "receipt.doneTitle")}
            message={step.already ? t("receipt.dupText") : t(step.updated === 1 ? "receipt.doneText.one" : "receipt.doneText.many", { count: step.updated })}
          />
          <Button onClick={onClose}>{t("receipt.done")}</Button>
        </>
      )}

      {step.kind === "unavailable" && (
        <>
          <Banner tone="warning" icon={CloudOff}>{t("receipt.sefaz")}</Banner>
          <Button icon={Camera} onClick={takePhoto}>{t("receipt.photo")}</Button>
          <Button variant="secondary" icon={RefreshCw} onClick={() => dispatch({ type: "paste" })}>{t("receipt.again")}</Button>
        </>
      )}
    </div>
  );
}
