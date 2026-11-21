import { useState } from "react";
import { Select } from "../../src";
import type { Locale } from "../App";
import { Section } from "../Section";

const strings = {
  "pt-BR": {
    name: "Select",
    account: "Conta",
    placeholder: "Escolha uma conta",
    hint: "Usada nos lançamentos novos.",
    error: "Escolha uma conta.",
    disabled: "Desativado",
    options: ["Conta corrente", "Poupança", "Cartão de crédito", "Dinheiro", "Investimentos", "Conta conjunta"],
  },
  en: {
    name: "Select",
    account: "Account",
    placeholder: "Choose an account",
    hint: "Used for new entries.",
    error: "Choose an account.",
    disabled: "Disabled",
    options: ["Checking", "Savings", "Credit card", "Cash", "Investments", "Joint account"],
  },
};

export default function SelectSection({ locale }: { locale: Locale }) {
  const t = strings[locale];
  const options = t.options.map((label, i) => ({ value: String(i), label }));
  const [value, setValue] = useState<string>();
  return (
    <Section name={t.name}>
      <Select label={t.account} options={options} value={value} onValueChange={setValue} placeholder={t.placeholder} hint={t.hint} />
      <Select label={t.account} options={options} value="1" onValueChange={() => {}} />
      <Select label={t.account} options={options} placeholder={t.placeholder} error={t.error} />
      <Select label={t.disabled} options={options} placeholder={t.placeholder} disabled />
    </Section>
  );
}
