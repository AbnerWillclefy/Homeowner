import { Banner, Button, EmptyState, Input, Sheet, Skeleton } from "@homeowner/bedrock";
import { Camera, ClipboardPaste, CloudOff, QrCode, Receipt as ReceiptIcon, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useAddReceipt } from "../hooks/useAddReceipt";
import { MatchLine } from "./MatchLine";
import { QrScanner } from "./QrScanner";

/** "Adicionar nota": its button, and the Sheet it opens. Closing returns focus to the button; a write in flight keeps the Sheet open. */
export function AddReceiptSheet() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next || !busy) && setOpen(next)}
      trigger={<Button variant="secondary" icon={ReceiptIcon}>{t("receipt.open")}</Button>}
      title={t("receipt.title")}
      closeLabel={t("app.close")}
    >
      {/* Mounted only while open, so each opening starts at "choose". */}
      <Flow onBusy={setBusy} onClose={() => setOpen(false)} />
    </Sheet>
  );
}

function Flow({ onBusy, onClose }: { onBusy(busy: boolean): void; onClose(): void }) {
  const { t } = useI18n();
  const { step, dispatch, submit, match } = useAddReceipt();
  // Kept here, not in the paste step, so a scanned code survives a failed read.
  const [code, setCode] = useState("");
  const [matching, setMatching] = useState(false);
  const busy = step.kind === "saving" || matching;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
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
      {step.kind === "choose" && (
        <>
          <p className="body text-text-muted">{t("receipt.chooseText")}</p>
          <Button size="lg" icon={QrCode} onClick={() => dispatch({ type: "scan" })}>{t("receipt.scan")}</Button>
          <Button size="lg" variant="secondary" icon={ClipboardPaste} onClick={() => dispatch({ type: "paste" })}>{t("receipt.paste")}</Button>
          {/* The photo path is its own ticket; until it lands the option is drawn but cannot be chosen. */}
          <Button size="lg" variant="secondary" icon={Camera} disabled>{t("receipt.photo")} · {t("receipt.photoSoon")}</Button>
        </>
      )}

      {step.kind === "scan" && (
        <>
          <QrScanner onCode={read} onDenied={() => dispatch({ type: "denied" })} />
          <p className="body text-center text-text-muted">{t("receipt.aim")}</p>
          <Button size="lg" variant="secondary" icon={ClipboardPaste} onClick={() => dispatch({ type: "paste" })}>{t("receipt.paste")}</Button>
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
          <Button type="submit" size="lg" disabled={code.trim() === ""}>{t("receipt.fetch")}</Button>
          <Button variant="ghost" icon={ScanLine} onClick={() => dispatch({ type: "scan" })}>{t("receipt.scan")}</Button>
        </form>
      )}

      {step.kind === "saving" && (
        <div aria-busy="true" aria-label={t("receipt.loading")} className="flex flex-col gap-4">
          <p className="body text-text-muted">{t("receipt.loading")}</p>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {step.kind === "matching" && <MatchLine step={step} match={match} onBusy={setMatching} />}

      {step.kind === "done" && (
        <>
          <EmptyState
            kind="done"
            icon={step.already ? ReceiptIcon : ScanLine}
            title={t(step.already ? "receipt.dupTitle" : "receipt.doneTitle")}
            message={step.already ? t("receipt.dupText") : t(step.updated === 1 ? "receipt.doneText.one" : "receipt.doneText.many", { count: step.updated })}
          />
          <Button size="lg" onClick={onClose}>{t("receipt.done")}</Button>
        </>
      )}

      {step.kind === "unavailable" && (
        <>
          <Banner tone="warning" icon={CloudOff}>{t("receipt.sefaz")}</Banner>
          {/* Until the photo ticket wires its step, the photo option only returns to "choose". */}
          <Button size="lg" icon={Camera} onClick={() => dispatch({ type: "choose" })}>{t("receipt.photo")}</Button>
          <Button size="lg" variant="secondary" icon={RefreshCw} onClick={() => dispatch({ type: "paste" })}>{t("receipt.again")}</Button>
        </>
      )}
    </div>
  );
}
