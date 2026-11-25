# A shared Bedrock design system amends 0007 and 0009 for apps that adopt it

Three front ends need one look and one set of accessible components: the PWA (`web/`), the admin (`admin/`) and Revenue, the finance app. Bedrock, specified in [`docs/design/bedrock/`](../design/bedrock/README.md), is that look. It overturns explicit choices in [ADR 0007](0007-tailwind-and-radix-for-an-accessible-calm-ui.md) (no shadcn/ui, light by default, 44px targets, one mobile column) and in the Look half of [ADR 0009](0009-navigate-with-a-bottom-tab-router-and-amend-the-look.md) (Nunito, per-Category pastels). This ADR amends both for apps that adopt Bedrock. Revenue adopted it first. `web/` adopts it in epic #882, and for `web/` this ADR supersedes 0007 and the Look half of 0009, except where noted below. `admin/` keeps its own design system ([ADR 0017](0017-operate-through-a-separate-admin-app-per-environment.md), `admin/design-system/homeowner-admin/MASTER.md`) until its own migration epic.

## Decision

We ship `@homeowner/bedrock` as TypeScript source in `/bedrock`, in the root npm workspace, beside the apps that consume it. It has no build step and is not published.

**Package shape**

- **Three layers.** Core holds every token except `cat-*` and `chore-*` and every component that names neither money nor a Chore, exported from `@homeowner/bedrock`. Finance holds what only a money app needs (`Amount`, `MoneyInput`, `CategoryTag`, `StatCard`, `ListRow`, `AlertCard`, the three money charts and the `cat-*` tokens), exported from `@homeowner/bedrock/finance`. Home holds what only the Chores app needs (the `chore-*` tokens, `ChoreTag`, `Effort`, `Energy`, `Streak` and `TaskCard`), exported from `@homeowner/bedrock/home`; its components are presentational only, and every Task fact and string comes in as a prop. Core imports neither Finance nor Home, and Home may import Core but not Finance, so a project that is about neither can use Core alone.
- **Two token tiers.** Primitives named by family and tone (`neutral-95`, `green-73`) hold the raw values. Semantic tokens (`surface`, `text`, `brand`) point to one primitive per theme. Components read only semantic tokens, so a re-brand changes primitives and no component.

**Rules for an adopting app, in place of 0007 and 0009**

1. **Components** come from shadcn/ui (Radix and Tailwind 4) with its helpers (`class-variance-authority`, `clsx`, `tailwind-merge`), copied into the package and restyled with Bedrock's tokens. The app imports them from Bedrock instead of growing its own `shared/ui/`; this replaces the `shared/ui/` rule of [ADR 0010](0010-organise-the-pwa-by-domain-module.md) and [ADR 0011](0011-split-each-domain-into-layer-folders.md) for generic primitives only, and domain folders stay as those ADRs say.
2. **Theme:** dark is the default on `:root`, and light sits under `[data-theme="light"]`. Each app owns its toggle, its storage and its pre-render script. The recommended default is the spec's: open in the operating system's theme (`prefers-color-scheme`), and use dark when there is no preference.
3. **Look:** Inter replaces Nunito. The `cat-*` colours and `CategoryTag`'s icons replace `DESIGN.md`'s Spending Category table (`spend-*` becomes `cat-*`, Taxes and fees gets `landmark`, Other gets `circle-ellipsis`). The `chore-*` colours (ten Categories, with Outros neutral) and `ChoreTag`'s icons replace 0009's per-Category pastels; this is the later decision v1 of this ADR deferred. The Category name always stays visible as text, so colour never carries the meaning alone. Touch targets are at least 48px (`control-lg`), in the PWA too, replacing 0007's 44px; a control drawn at 32 or 40 extends its hit area without changing its look. Layouts are desktop first with a phone form, at breakpoints `bp-tablet` (768), `bp-desktop` (1024) and `bp-wide` (1280), replacing 0007's single 32rem column. **Exception: the PWA (`web/`) stays phone only** and keeps 0007's single column at every width, because Residents use it on their phones and its design has phone artboards only.
4. **Strings and money:** the package has no i18n of its own. Every string comes in as a prop. Money is formatted with `Intl` (default `pt-BR`, BRL). [ADR 0006](0006-localize-with-a-small-typed-module.md) is unchanged.
5. **What still holds from 0007:** native HTML first, semantic tokens only (no raw palette classes, no literal colour, spacing or z-index), `motion-safe`, and WCAG 2.2 AA.

**Text sizes stay in rem.** The spec writes its type scale in px (`docs/design/bedrock/tokens.css`). The package writes every font size and line height in `rem` at a 16px base (14px is `0.875rem`), so the spec's px are the values a Resident sees at the default text size, and text still follows the iOS and Android font size, as 0007 requires. An adopting app that runs on phones keeps 0007's `font: -apple-system-body` on `<html>`; on iOS this makes the default root 17px, so Bedrock text there is about 6% larger than the spec's px, which we accept. Spacing, radii and breakpoints stay in px. Control heights are minimums, so a control grows with its text instead of clipping it.

**Verification.** 0007's manual-only check no longer holds for Bedrock itself: Vitest runs axe in jsdom over the showcase, in both themes and both locales, and a token test checks contrast from `tokens.css`. The manual VoiceOver, TalkBack, keyboard and largest-text pass still applies to each adopting app's screens.

**Revenue** joined the workspace, which avoids shipping two copies of React, and the PWA joins it in epic #882.

## Considered Options

- **Each app keeps its own `components/ui`:** nothing shared to set up, but the look drifts and every accessible widget is built three times.
- **Publish to a registry:** clean versioned installs, but it adds a release step, registry credentials and a service that can bill, for three apps in one repository.
- **Build into `dist` with tsup:** a build step every consumer has to run first, when Vite can compile the TypeScript source directly.
- **Storybook for the showcase:** heavy, where one Vite dev page shows every component in both themes and locales.
- **Accept px for text:** matches the spec literally, but Dynamic Type and Android's font size would no longer scale Bedrock text, which breaks 0007's promise to Residents who need large text.

## Consequences

- Each consumer adds Tailwind `@source` pointing at `bedrock/src` and imports Bedrock's stylesheet, or its classes are missing. It also dedupes React (by joining the workspace, or with Vite's `resolve.dedupe`), or hooks break on two copies.
- A migration flips `data-theme` and swaps the token set in one pull request.
- Bedrock's easy reversal (Desfazer in a Toast, no confirmation) needs an undo for every action. In the PWA, the actions the API cannot invert are held until their Toast closes ([ADR 0029](0029-undoable-task-and-chore-actions-are-sent-when-their-toast-closes.md)).
- Contrast is checked from the tokens, because axe in jsdom cannot compute colour.
- The spec's px type scale and the package's rem values must agree at a 16px base; a token test or review keeps them in step.

**Adoption concerns**, and how the PWA's migration (epic #882) answers them:

- **Token name collisions.** `web/src/tokens.css` and Bedrock both define names such as `--color-surface`. A migrating app must not load both sets together, or whichever loads last silently wins. The PWA replaces its tokens with Bedrock's plus a temporary alias layer for its old names, removed at the end of the epic.
- **Inverted theme default.** `web/` puts light on `:root` and dark under `[data-theme="dark"]`, stored under `homeowner.theme`; Bedrock is the reverse. A migration must map the stored choice to the new attribute values, so a Resident who chose Dark does not get light, and one who chose Light does not get dark. Answered by #889: the key stays, a stored choice is kept, and only "no preference at all" now resolves to dark.
- **Density.** 48px targets change how the PWA's phone screens feel. The PWA takes them (rule 3), and its phone artboards are drawn with them; desktop-first layouts do not apply, because the PWA stays phone only.
