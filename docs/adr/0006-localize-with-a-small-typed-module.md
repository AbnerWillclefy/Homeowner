# Localize with a small typed module, not a library

The PWA is shown in US English (`en-US`) or Brazilian Portuguese (`pt-BR`), chosen from the device's language. We build this as a small typed module in `web/src/i18n/` on top of the platform `Intl` API, with no i18n library.

## Decision

- **No library.** About ten strings today and perhaps forty after #48, in two languages. Plurals, numbers and dates already exist in `Intl.PluralRules`, `Intl.NumberFormat` and `Intl.DateTimeFormat`. The main chunk went from 243.66 kB (76.17 kB gzip) before the module to 246.20 kB (77.14 kB gzip) after it, including both catalogs and the provider: about 1 kB gzip. A library would add tens of kB gzip that we would use about 5 percent of.
- **Catalog format.** Typed TypeScript modules, one per locale (`catalogs/en-US.ts`, `catalogs/pt-BR.ts`). `en-US` is the source of truth and defines `MessageKey`. `pt-BR` is typed with a mapped type over those keys, so a missing key, an extra key or a string where a plural is expected fails `npm run typecheck`. A parity test catches what types cannot: empty values and mismatched `{placeholders}`. Keys are flat and dotted, grouped by screen (`health.retry`). A message is a whole sentence with `{name}` placeholders, or a plural object `{ one, other, many? }` chosen with `Intl.PluralRules`. Number params are formatted for the locale.
- **Fallback.** A key missing or empty in `pt-BR` shows its `en-US` text. It never shows a blank or the key name (the key is returned only if even `en-US` lacks it, which needs a cast to happen).
- **Locale resolution.** `resolveLocale` is pure and never throws. Order: a valid stored choice, then the first entry of `navigator.languages` whose primary subtag is `pt` (to `pt-BR`) or `en` (to `en-US`), then `en-US`. There is no locale in the URL. Portuguese from Portugal (`pt-PT`) gets Brazilian wording: that is a product decision, and a separate `pt-PT` catalog would need its own native-speaker review. The stored choice (#50) lives in `localStorage` under `homeowner.locale`, and its value is a bare `Locale` tag (`en-US` or `pt-BR`), not JSON. It is written only when the Resident explicitly picks a language in Settings, never from the detected language. `isLocale` validates it on read, so any other value is ignored and the browser language applies. A storage failure (blocked, full or absent) is silent: the choice then lasts for the session only. The service worker does not read it; a later mirror into IndexedDB is possible. The backend follow-up (`users.locale`, push text by locale) reuses the same two BCP 47 tags, `en-US` and `pt-BR`; its sync semantics are left to its own ADR.
- **Closed set of BCP 47 tags.** `LOCALES = ["en-US", "pt-BR"]` in `locales.ts`, with no imports, so the service worker (#49) and the backend (`users.locale`, `Accept-Language`) reuse the same tags.
- **Offline.** Both catalogs are imported statically and land in the precached main chunk, so both languages work offline with no service worker change. The service worker cannot share a React runtime; #49 gives it its own tiny fallback strings built on `locales.ts` and `resolveLocale.ts`.
- **The page's `lang`.** The provider sets `<html lang>` to the shown locale before paint, because screen readers pick their voice from it. `index.html` ships `lang="en-US"` for the moment before JavaScript runs.
- **One manifest, in English.** The app name is a brand and is the same in both languages. The manifest `description` stays English: there are no per-locale manifests.
- **Wording.** Agreed `pt-BR` equivalents of the [CONTEXT.md](../../CONTEXT.md) terms are in [docs/glossary-pt-BR.md](../glossary-pt-BR.md).
- **Components import only from `src/i18n`** (its `index.ts`), so swapping in a library later touches that folder only.

## Considered Options

- **i18next with react-i18next:** mature, with plugins and namespaces, but a runtime and plugin model we would use a sliver of, and stringly-typed keys that need a generated type layer for compile-time completeness.
- **FormatJS with react-intl:** full ICU MessageFormat, but a message parser and a larger runtime, plus a build step to precompile messages.
- **LinguiJS:** compile-time catalogs and small output, but extraction tooling and macros for two locales.
- **Hand-rolled with no `Intl`:** rejected; plural rules differ (Portuguese treats 0 and 1 as `one`) and the platform already has them.

## Consequences

We accept these limits: no ICU MessageFormat (no `select`, no nested plurals), no rich text or JSX inside messages (split into several keys if a link or bold span is ever needed), and literal braces cannot appear in a message.

We revisit this if we support more than about four locales, if translators need ICU MessageFormat or a translation-management tool, or if the catalogs grow above about 30 kB.

The first `pt-BR` copy is drafted by an engineer, so every pull request that adds Portuguese text lists it next to its English source for native-speaker review.

Out of scope here: the reminders text (#48), push text in the service worker (#49), and the backend follow-up (`users.locale` and push text by locale, and syncing the stored choice), which will get its own ADR.
