import { useState } from "react";
import { Button, Toast, ToastProvider } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "Toast", label: "Notificações", close: "Fechar",
    openPositive: "Alterar categoria", openDanger: "Falha de conexão", openNeutral: "Aviso simples",
    positive: "Categoria alterada para Mercado", undo: "Desfazer", undoAlt: "Desfazer a mudança de categoria",
    danger: "Não foi possível conectar ao Nubank. Tente de novo", retry: "Tentar", retryAlt: "Tentar conectar ao Nubank de novo",
    neutral: "Lembrete salvo",
  },
  en: {
    name: "Toast", label: "Notifications", close: "Close",
    openPositive: "Change category", openDanger: "Connection failure", openNeutral: "Plain notice",
    positive: "Category changed to Groceries", undo: "Undo", undoAlt: "Undo the category change",
    danger: "Could not connect to Nubank. Try again", retry: "Retry", retryAlt: "Try connecting to Nubank again",
    neutral: "Reminder saved",
  },
};

export default function ToastSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [open, setOpen] = useState({ positive: false, danger: false, neutral: false });
  const set = (k: keyof typeof open, v: boolean) => setOpen((o) => ({ ...o, [k]: v }));
  return (
    <Section name={t.name}>
      <ToastProvider label={t.label}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => set("positive", true)}>{t.openPositive}</Button>
          <Button variant="secondary" onClick={() => set("danger", true)}>{t.openDanger}</Button>
          <Button variant="secondary" onClick={() => set("neutral", true)}>{t.openNeutral}</Button>
        </div>
        <Toast tone="positive" title={t.positive} closeLabel={t.close} open={open.positive} onOpenChange={(v) => set("positive", v)}
          action={{ label: t.undo, altText: t.undoAlt, onClick: () => set("positive", false) }} />
        <Toast tone="danger" title={t.danger} closeLabel={t.close} open={open.danger} onOpenChange={(v) => set("danger", v)}
          action={{ label: t.retry, altText: t.retryAlt, onClick: () => set("danger", false) }} />
        <Toast tone="neutral" title={t.neutral} closeLabel={t.close} open={open.neutral} onOpenChange={(v) => set("neutral", v)} />
      </ToastProvider>
    </Section>
  );
}
