import { useState } from "react";
import { Input } from "../../src";
import { MoneyInput } from "../../src/finance";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "Nome",
    nameHint: "Como aparece no seu documento.",
    nameError: "Informe seu nome.",
    amount: "Valor",
    amountHint: "Digite ou cole, por exemplo 1.234,56.",
    limit: "Limite mensal",
    limitError: "Informe um valor maior que zero.",
    disabled: "Desativado",
  },
  en: {
    name: "Name",
    nameHint: "As shown on your ID.",
    nameError: "Enter your name.",
    amount: "Amount",
    amountHint: "Type or paste, for example 1,234.56.",
    limit: "Monthly limit",
    limitError: "Enter an amount above zero.",
    disabled: "Disabled",
  },
};

export default function InputSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const [amount, setAmount] = useState<number | null>(123456);
  const [limit, setLimit] = useState<number | null>(0);
  return (
    <Section name="Input / MoneyInput">
      <Input label={t.name} hint={t.nameHint} autoComplete="off" />
      <Input label={t.name} defaultValue="" error={t.nameError} />
      <Input label={t.disabled} disabled defaultValue="..." />
      <MoneyInput label={t.amount} hint={t.amountHint} value={amount} onValueChange={setAmount} />
      {/* Zero is a valid amount: a field that cannot take it passes an error. */}
      <MoneyInput
        label={t.limit}
        value={limit}
        onValueChange={setLimit}
        error={limit === 0 ? t.limitError : undefined}
      />
    </Section>
  );
}
