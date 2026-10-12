// Each language named in itself (endonyms). They are deliberately NOT in the catalogs:
// someone in the wrong language must still be able to read the option for their own,
// so the names never change with the active locale. The Record type makes a new
// locale a compile error until it has a name here.
import type { Locale } from "./locales";

export const LANGUAGE_NAME: Record<Locale, string> = {
  "en-US": "English",
  "pt-BR": "Português",
};
