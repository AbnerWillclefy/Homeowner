# Revenue screens

The approved design for Revenue (epic #623), copied from the design canvas so the agents building it can read it. Each `.dc.html` file is one artboard: its markup is the layout to build, its `<script>` holds the sample data and interactions. They render only inside the canvas (they load its `support.js` runtime), so read them as source.

This copy is what screens are built and reviewed against (`revenue/CLAUDE.md`, `REVIEW.md`). A design change made in the canvas comes here in a pull request before any ticket builds on it.

Classes map to the code like this:

- `br-*` are Bedrock components (`docs/design/bedrock/components/`, built in `bedrock/src/`).
- `rv-*` are Revenue's page layout, in [`revenue.css`](revenue.css): the page frame (`rv-app`, `rv-side`, `rv-main`), the page header (`rv-head`, `rv-title`, `rv-sub`, `rv-tools`), the 12-column grid (`rv-grid` with `s3`…`s12` spans) and the side panel (`rv-panel`, `rv-scrim`).
- `ri ri-<name>` are icons; use the Lucide icon of the same meaning.

Wording in the artboards is illustrative. The i18n catalogs and `docs/glossary-pt-BR.md` own the real words: the sidebar says Lançamentos, Objetivos, Categorias de gasto and Fontes where the artboards say Transações, Metas, Categorias and Contas.

| Screen | Route | Desktop | Mobile |
|---|---|---|---|
| Sidebar (shared by every desktop screen) | | [Sidebar](Sidebar.dc.html) | |
| Overview | `/` | [Main](Main.dc.html) | [MobileOverview](MobileOverview.dc.html) |
| More (phone tab) | | | [MobileMore](MobileMore.dc.html) |
| Plan (phone tab) | | | [MobilePlan](MobilePlan.dc.html) |
| Transactions | `/transactions` | [Transactions](Transactions.dc.html) | [MobileTransactions](MobileTransactions.dc.html) |
| Bills to pay | `/bills` | [Bills](Bills.dc.html) | [MobileBillsList](MobileBillsList.dc.html), and [MobileBills](MobileBills.dc.html) for the Overview's bills sheet |
| Card bills | `/card-bills` | [CardBills](CardBills.dc.html) | [MobileCardBills](MobileCardBills.dc.html) |
| Spending Categories | `/categories` | [Categories](Categories.dc.html) | [MobileCategories](MobileCategories.dc.html) |
| Goals | `/goals` | [Goals](Goals.dc.html) | [MobileGoals](MobileGoals.dc.html) |
| Net worth | `/net-worth` | [NetWorth](NetWorth.dc.html) | [MobileNetWorth](MobileNetWorth.dc.html) |
| Projection | `/projection` | [Projection](Projection.dc.html) | [MobileProjection](MobileProjection.dc.html) |
| Sources | `/sources` | [Accounts](Accounts.dc.html) | [MobileSources](MobileSources.dc.html) |
| Pantry | `/pantry` | [Pantry](Pantry.dc.html) (with the item sheet as its side panel) | [MobilePantry](MobilePantry.dc.html) (under Mais, not in the bottom bar) |
| Pantry item sheet | `/pantry` (row) | [Pantry](Pantry.dc.html), prop `panel` | [MobilePantryItem](MobilePantryItem.dc.html) |
| Shopping list | `/pantry/list` | [ShoppingList](ShoppingList.dc.html) | [MobileShoppingList](MobileShoppingList.dc.html) |
| Chat | `/chat` | [Chat](Chat.dc.html) | [MobileChat](MobileChat.dc.html) (full screen, no bottom bar) |
| Add receipt | `/pantry` (sheet) | the same sheet as an `rv-panel` | [MobileAddReceipt](MobileAddReceipt.dc.html) (steps switched by the prop `step`) |
| Settings | `/settings` | [Settings](Settings.dc.html) | [MobileSettings](MobileSettings.dc.html) |
| Onboarding | `/onboarding` | [Onboarding](Onboarding.dc.html) | |

Every screen has a phone artboard; a new screen gets one before it is built (Bedrock, Layout and responsiveness). On the phone: the `PageHeader` takes two rows (title and icon actions, then the month at full width), the bottom bar has four tabs (Início · Lançamentos · Planejar · Mais, with Bills to pay inside Mais and its count on the Mais tab), a row has at most one action drawn as a 48px icon button, and label and value pairs use `DescriptionList` (`rv-dl` in `revenue.css`). The Projection artboards (desktop and phone) were redrawn on 20/11/2026 with the data the screen shows today: one leftover series at a time (by the plan or at the current pace), a month's sum beside the chart, and a six-column table.

Pantry artboards take the props `locale` (`pt-BR` or `en`, the English check) and `view` (`ready`, `empty`, `loading`, `error`); the shopping list adds `limit` (`ok`, `over`, `none`) and Add receipt switches by `step`. The Pantry sits in "Mais" on the phone and in the Sidebar on desktop.

The chat artboards take `locale` and `view` (`empty` with suggestions, `working`, `answer`, `error`, `limit`, plus `near` and `full` for the 500-character counter). The floating button is the prop `ask` (on by default) of [Transactions](Transactions.dc.html) and [MobileTransactions](MobileTransactions.dc.html).

## Chat decisions

The screen tickets (#798, #799) copy these into their acceptance criteria.

- **Sidebar item.** "Perguntar" (Lucide `message-circle`) is the last item of the "Principal" group, after Despensa. It is not in "Mais" on the phone: the floating button is the phone's way in, so the screen code lists it in no row of Planejar or Mais.
- **Floating button.** A 48 px pill built from Bedrock's `Button` (primary), Lucide `message-circle` and "Perguntar" always visible. On the phone: 16 px from the right and 16 px above the bottom bar (`bottom: 96px`, which clears the 24 px safe area). On desktop: bottom right of the content, 32 px in, fixed, never over the Sidebar. Shown on every screen inside the frame except Onboarding and the chat. A list gets `96px` of bottom padding so its last row scrolls clear. A Toast sits 64 px higher while it shows (`rv-toastwrap--fab`).
- **Chat layout.** Title "Perguntar", subtitle "Pergunte sobre seu dinheiro", no tools. Desktop: one column, max-width 720 px, centered in the main area, no grid and no cards. The input is pinned to the bottom of the column. Phone: full screen, no bottom bar, a back button at the left of the title. One `/chat` route for both.
- **Input.** A single-line Bedrock `Input` (questions are short, so no `Textarea`) and a 48 px icon send button (Lucide `arrow-up`, accessible name "Enviar"), `maxlength` 500. The counter ("482/500") shows from 450 characters; at 500 the field takes the error state ("Limite de 500 caracteres") and send is disabled.
- **Working.** The question shows at once, with a pending reply of two `Skeleton` lines and "Pensando…" in a `role="status"` bubble; send is disabled.
- **Remaining count.** Only after an answer, as muted text under it: "Restam 17 perguntas hoje", singular "Resta 1 pergunta hoje" (en "17 questions left today", "1 question left today").
- **Limit.** A plain card with a clock icon and "Você usou suas 20 perguntas de hoje. Volte amanhã.", not drawn as a reply bubble. The input and send are disabled.
- **Error.** A danger `Banner` below the question, which stays visible, with "Tentar de novo". The note "Tentar de novo conta como uma pergunta." is drawn because a retry counts against the day's 20 (#796).
- **Answers are plain text.** The bubble keeps line breaks (`white-space: pre-wrap`) and draws no bold, link, list or image.
- **Hide values.** The chat ignores the hide-values toggle: the answer is model text and cannot be masked. #798 lists it under "Differs from the design".
- **Notice.** One line under the input, "Pode errar. Não é conselho financeiro." (ADR: advisory only). Drawn pending the product manager's agreement.
