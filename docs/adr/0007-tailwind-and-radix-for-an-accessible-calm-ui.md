# Tailwind and Radix for an accessible, calm UI

The PWA's UI is built with Tailwind CSS v4 over semantic design tokens, native HTML elements first, and Radix Primitives only for widgets native HTML cannot make accessible. The target is WCAG 2.2 AA across the app, in a look that is calm and native-feeling, because Residents open it on low-Energy days and the product advises and never commands.

## Decision

- **Styling:** Tailwind CSS v4. Semantic tokens are defined in `@theme` as CSS custom properties (`--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-danger`, `--color-focus`, more semantic names as needed). Components use semantic classes (`bg-surface text-text`), never raw palette classes like `bg-teal-600`. Light and dark values are defined once, so tokens swap per theme and `dark:` variants are not needed on every element.
- **Components:** native HTML first. Radix Primitives only for widgets native HTML cannot make accessible, such as dialog, select, switch, menu and toast. Our own small `web/src/components/ui/`, where a component is added only when a screen needs it. No shadcn/ui for now.
- **Accessibility:** WCAG 2.2 AA. Touch targets at least 44px. iOS Dynamic Type via `font: -apple-system-body` on `<html>` and all sizes in `rem`; layouts must hold at the largest accessibility text size. Android Chrome scales `rem` with the system font size.
- **Look:** system font stack, no web font download (this also helps offline). Generous white space, soft surfaces, one calm teal or green accent, chosen to stay distinct from warning and danger states and to pass AA on light and dark surfaces. Icons from `lucide-react`, importing only what is used.
- **Colour scheme:** follows `prefers-color-scheme` by default, with an in-app choice of System (default), Light or Dark. Stored in localStorage under `homeowner.theme`, following the device-storage pattern #50 uses for `homeowner.locale`. Applied as `data-theme` on `<html>` by a small inline script in `index.html` before React renders, so the wrong theme never flashes.
- **Motion:** minimal. Short fades and slides under 200ms, only for state changes, always behind Tailwind's `motion-safe:` variant, so reduced motion means no animation. Richer motion (for example Streak celebrations) is a separate future decision.
- **Layout:** mobile-first, one centred column with a max width of about 32rem on all screen sizes. No desktop layout in v1. Safe-area insets are respected.
- **Settings:** language (#50) and appearance live in one Settings section at the bottom of the home screen. It moves to its own screen when the first ticket that needs a second screen brings in a router and the navigation pattern; that choice is deferred until then.
- **Verification:** spec #1 has no automated UI tests in v1. Every screen ticket's pull request reports a manual checklist: VoiceOver on iPhone, TalkBack on Android, keyboard-only navigation with visible focus, the largest Dynamic Type / system font size, light and dark themes, and AA contrast checked in DevTools. Automated axe checks are added to the Playwright smoke test that spec #1 already plans as the first UI-test addition.

## Considered Options

- **Plain CSS + CSS Modules:** no dependency, but tokens, theming and a consistent spacing scale would all be hand-built and policed by review.
- **CSS-in-JS (vanilla-extract, Panda):** typed tokens, but more build machinery and runtime or codegen weight for a one-column app.
- **react-aria-components:** better mobile screen reader support than Radix. The maintainer chose Radix, and the manual VoiceOver and TalkBack pass compensates.
- **Hand-rolling every widget:** accessible dialogs, selects and menus are hard to get right; Radix covers only the few that native HTML cannot.
- **shadcn/ui:** dropped for now, since its helper libraries and default look do not fit this design.

## Consequences

Accessibility is verified by hand until the Playwright smoke test gains axe checks, so each screen pull request carries the manual checklist and a reviewer can reject one that skips it. Raw palette classes in components are a review failure, which keeps a later re-theme to a single `@theme` edit.

Sequencing: #47 (i18n) and #48 land unchanged. A "UI foundation" ticket then installs Tailwind, Radix and lucide-react, adds the tokens, the theme script and the Settings section, and converts the existing screens (`App.tsx`, `push/Reminders.tsx`). #50 is blocked by the foundation ticket and builds its language selector into the Settings section.
