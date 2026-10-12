# Navigate with a bottom-tab router and amend the look of ADR 0007

The PWA outgrew one scrolling home screen. [ADR 0007](0007-tailwind-and-radix-for-an-accessible-calm-ui.md) deferred the navigation pattern until a second screen needed it; it now does. This ADR records that choice, and a calmer, friendlier look that gives each Category its own colour.

## Decision

**Navigation**

- **React Router, declarative mode** (`BrowserRouter` and `Routes`), not data or framework mode. The app has no server rendering and fetches through its own hooks.
- **Four bottom tabs: Today, Chores, Home, Me.** One thumb-reachable bar, each tab a real route with its own URL.
- **Auth and onboarding are full-screen routes** outside the tabs, so the bar never shows to someone who cannot use it yet.
- **Dialogs sit over Today and have no URL.** The Invite join, the rating step and the start choice are Radix dialogs shown on Today. Back never lands on a half-finished dialog.
- **Invite links stay as fragments** (`#invite=...`), so the token is never sent to a server or logged in a request path.
- **Onboarding progress is kept on the server**, not in the URL or device storage, so it follows the Resident to another phone.

**Look (amends ADR 0007's Look)**

- **Nunito** is the app font, self-hosted (latin subset, weights 400, 600 and 700 only), with the system stack as fallback. ADR 0007's "system font stack, no web font" no longer holds.
- **Per-Category pastels:** six semantic fills (peach, mint, lavender, blue, yellow, salmon) each with a paired ink, in light and dark. Kitchen is peach; bathroom mint; bedroom and living room lavender; laundry and floors blue; trash and outdoor yellow; pets salmon; other and anything unknown is neutral. The Category name always stays as text, so meaning never rests on colour.
- **The teal accent is kept** for primary actions; pastels mark Categories, not actions.
- Rounder corners through radius tokens. Everything else in ADR 0007 (semantic tokens, no `dark:` variants, Radix only where native HTML cannot, WCAG 2.2 AA, `rem` sizes, `motion-safe:`) stands.

## Considered Options

- **Keep the single scrolling home screen:** no router, but every new section lengthens one page, and nothing can be linked to or reached with Back.
- **Data or framework router mode:** loaders and actions would duplicate the hooks that already own fetching.
- **A drawer or top menu:** harder to reach one-handed on a phone.
- **Keep the system font:** nothing to download, but less character. Nunito's cost is small and bounded.

## Consequences

- URLs and history are now part of the product: a route that ships is hard to rename or remove without breaking links and bookmarks.
- Nunito adds three `.woff2` files to the precache, so the first install downloads slightly more. Offline rendering in Nunito depends on them being precached (`woff2` is in the `injectManifest` globs).
- The pastel palette widens the contrast surface: each ink on its fill, and `border`, `focus`, `text` and `muted` on the fills a card can carry, in both themes. `src/theme/contrast.test.ts` checks them from the values in `index.css` and fails the build on a regression.
- Each Category is mapped to its pastel and icon in one place (`components/ui/categoryStyle.ts`); a new Category without a style fails a test.
