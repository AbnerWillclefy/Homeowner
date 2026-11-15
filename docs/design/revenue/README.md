# Revenue screens

The approved design for Revenue (epic #623), copied from the design canvas so the agents building it can read it. Each `.dc.html` file is one artboard: its markup is the layout to build, its `<script>` holds the sample data and interactions. They render only inside the canvas (they load its `support.js` runtime), so read them as source.

Classes map to the code like this:

- `br-*` are Bedrock components (`docs/design/bedrock/components/`, built in `bedrock/src/`).
- `rv-*` are Revenue's page layout, in [`revenue.css`](revenue.css): the page frame (`rv-app`, `rv-side`, `rv-main`), the page header (`rv-head`, `rv-title`, `rv-sub`, `rv-tools`), the 12-column grid (`rv-grid` with `s3`…`s12` spans) and the side panel (`rv-panel`, `rv-scrim`).
- `ri ri-<name>` are icons; use the Lucide icon of the same meaning.

Wording in the artboards is illustrative. The i18n catalogs and `docs/glossary-pt-BR.md` own the real words: the sidebar says Lançamentos, Objetivos, Categorias de gasto and Fontes where the artboards say Transações, Metas, Categorias and Contas.

| Screen | Route | Desktop | Mobile |
|---|---|---|---|
| Sidebar (shared by every desktop screen) | | [Sidebar](Sidebar.dc.html) | |
| Overview | `/` | [Main](Main.dc.html) | [MobileOverview](MobileOverview.dc.html) |
| Transactions | `/transactions` | [Transactions](Transactions.dc.html) | [MobileTransactions](MobileTransactions.dc.html) |
| Bills to pay | `/bills` | [Bills](Bills.dc.html) | [MobileBills](MobileBills.dc.html) (the bills side panel as a bottom sheet) |
| Card bills | `/card-bills` | [CardBills](CardBills.dc.html) | |
| Spending Categories | `/categories` | [Categories](Categories.dc.html) | |
| Goals | `/goals` | [Goals](Goals.dc.html) | |
| Net worth | `/net-worth` | [NetWorth](NetWorth.dc.html) | |
| Projection | `/projection` | [Projection](Projection.dc.html) | |
| Sources | `/sources` | [Accounts](Accounts.dc.html) | |
| Settings | `/settings` | [Settings](Settings.dc.html) | |
| Onboarding | `/onboarding` | [Onboarding](Onboarding.dc.html) | |

Screens with no mobile artboard follow Bedrock's adaptation rules: the 12-column grid becomes one column, the side panel becomes a bottom sheet and the sidebar becomes the bottom bar.
