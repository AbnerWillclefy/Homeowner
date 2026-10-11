// Brazilian Portuguese. The compiler requires exactly the keys of en-US, with a
// plain string where en-US has a string and a plural object where it has one.
//
// - Informal "você". Domain terms follow docs/glossary-pt-BR.md.
// - Keep placeholders {name} exactly as in en-US (catalogs.test.ts checks).
// - One whole sentence per key.
import type { enUS, MessageKey } from "./en-US";

type Messages = {
  [K in MessageKey]: (typeof enUS)[K] extends string
    ? string
    : { one: string; other: string; many?: string };
};

export const ptBR: Messages = {
  "app.name": "Homeowner",
  "home.tagline": "Divida os afazeres domésticos do seu lar de forma justa.",
  "health.loading": "Verificando o serviço...",
  "health.ok": "Status do serviço: ok",
  "health.unavailable":
    "Status do serviço: indisponível. O serviço está no ar, mas não consegue acessar o banco de dados.",
  "health.unreachable": "Status do serviço: inacessível. Verifique sua conexão e tente novamente.",
  "health.retry": "Tentar novamente",
  "auth.checking": "Verificando seu login...",
};
