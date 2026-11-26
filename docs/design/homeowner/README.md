# Homeowner PWA screens

The approved design for the PWA on Bedrock (epic #882), copied from the design canvas so the agents building it can read it. Each `.dc.html` file is one artboard: its markup is the layout to build, its `<script>` holds the sample data and interactions. They load the canvas's `support.js` runtime, which is not copied, so they do not open in a plain browser; read them as source. The `ui-screenshots` check renders them outside the canvas with its stand-in, `.github/scripts/dc-runtime.js` (ADR 0028), together with `home.css`, which is copied here and fails the check if it goes missing. `web/e2e/pairs/screens.ts` maps every artboard to a screen of the app or says why it has none; a test fails when a file here has no entry.

This copy is what screens are built and reviewed against. A design change made in the canvas comes here in a pull request before any ticket builds on it.

**Phone only.** There are no desktop artboards: the PWA is declared phone only (`PRODUCT.md`, Bedrock's Layout and responsiveness). There are no English artboards either: the English UI follows the pt-BR wording through the catalogs. Every artboard takes the prop `theme` (`dark` or `light`); `BottomBar` takes `active` instead.

Classes map to the code like this:

- `br-*` are Bedrock components (`docs/design/bedrock/components/`). Core ones are built in `bedrock/src/components/`; the Home layer (`br-chore`, `br-effort`, `br-energy`, `br-streak`, `br-task`) goes in `bedrock/src/home/` (#887).
- `br-stepper*` in the onboarding and Forgot password artboards is the **step indicator**, not the built `Stepper` (see Naming below).
- `hm-*` are the page layout, drawn by [`home.css`](home.css), copied from the canvas: the phone frame (`hm-phone`, `hm-scroll`), the header (`hm-head`, `hm-title`, `hm-sub`, `hm-tools`, `hm-bar`, `hm-back`), sheets and dialogs (`hm-overlay`, `hm-sheet*`, `hm-dialog`), the toast (`hm-toast`), lists and rows (`hm-list`, `hm-item*`, `hm-check`, `hm-box`), fields (`hm-field`, `hm-label`, `hm-input`, `hm-seg`, `hm-caption`) and the auth and onboarding column (`hm-auth`, `hm-foot`). In code they belong to the PWA's frame (`web/src/app/components/PageFrame.tsx`, `Shell.tsx`) or to the Bedrock component of the same role (`Sheet`, `Toast`, `PageHeader`, `SegmentedControl`, `Checkbox`). `home.css` is not the spec: the code builds these roles, it does not import the file.
- `ri ri-<name>` are icons; use the Lucide icon of the same meaning.

Wording in the artboards is illustrative. The i18n catalogs (`web/src/shared/i18n/catalogs/`) and `docs/glossary-pt-BR.md` own the real words.

## Naming: step indicator and +/- control

The canvas calls the "Passo N de M" indicator **`Stepper`** and the +/- control **`Counter`**. The existing Core `Stepper` (`bedrock/src/components/stepper.tsx`, used by `revenue/src/domains/pantry/components/QuantitySheet.tsx` and `ShoppingRows.tsx`) is the +/- control, so it is the canvas's `Counter`. `docs/design/bedrock/` keeps `Stepper` as the +/- control and files the indicator as `StepIndicator` (`br-step-indicator*`) so the two never share a class. Which code name wins is #886's call.

## Screens

| Screen | Route | Artboard |
|---|---|---|
| **Hoje** | | |
| Today, plan | `TODAY_PATH` (`/`) | [Main](Main.dc.html) |
| Today, before the check-in | `/` | [TodayCheckIn](TodayCheckIn.dc.html) |
| Today, all done | `/` | [TodayDone](TodayDone.dc.html) |
| Today, loading | `/` | [TodayLoading](TodayLoading.dc.html) |
| Today, offline | `/` | [TodayOffline](TodayOffline.dc.html) |
| Check-in | `/` (sheet) | [CheckIn](CheckIn.dc.html) |
| Task detail | `/` (sheet) | [TaskSheet](TaskSheet.dc.html) |
| Offer a swap | `/` (sheet) | [SwapSheet](SwapSheet.dc.html) |
| Streak | `/` (sheet) | [StreakSheet](StreakSheet.dc.html) |
| Voice | `/` (sheet) | [VoiceSheet](VoiceSheet.dc.html) |
| When to start | `/` (sheet) | [StartChoice](StartChoice.dc.html) |
| **Afazeres** | | |
| Chores | `CHORES_PATH` (`/chores`) | [Chores](Chores.dc.html) |
| Chore, edit | `/chores` (sheet) | [ChoreSheet](ChoreSheet.dc.html) |
| Chores, first use | `/chores` | [ChoresEmpty](ChoresEmpty.dc.html) |
| Catalog, questions | `/chores` | [CatalogQuestions](CatalogQuestions.dc.html) |
| Catalog, suggestions | `/chores` | [CatalogReview](CatalogReview.dc.html) |
| **Lar** | | |
| Home | `HOME_PATH` (`/home`) | [Home](Home.dc.html) |
| Resident | `RESIDENT_PATH` (`/home/residents/:id`) | [Resident](Resident.dc.html) |
| Invite | `/home` (sheet) | [InviteSheet](InviteSheet.dc.html) |
| Home settings | `/home` (sheet) | [HomeSettings](HomeSettings.dc.html) |
| Leave the Home | `/home` (dialog) | [LeaveDialog](LeaveDialog.dc.html) |
| **Eu** | | |
| Me | `ME_PATH` (`/me`) | [Me](Me.dc.html) |
| Your name | `ME_EDIT_PATH` (`/me/edit`) | [NameEdit](NameEdit.dc.html) |
| Baseline | `/me` (sheet) | [BaselineSheet](BaselineSheet.dc.html) |
| Preferences | `/me` (sheet) | [PreferencesSheet](PreferencesSheet.dc.html) |
| Restrictions | `/me` (sheet) | [RestrictionsSheet](RestrictionsSheet.dc.html) |
| My completions | `/me` | [Completions](Completions.dc.html) |
| Appearance and language | `/me` (sheet) | [AppearanceSheet](AppearanceSheet.dc.html) |
| Account | `/me` (sheet) | [AccountSheet](AccountSheet.dc.html) |
| **Entrada** | | |
| Sign in | `SIGN_IN_PATH` (`/signin`) | [SignIn](SignIn.dc.html) |
| Sign up | `SIGN_UP_PATH` (`/signup`) | [SignUp](SignUp.dc.html) |
| Confirm email | `CONFIRM_PATH` (`/confirm`) | [Confirm](Confirm.dc.html) |
| Forgot password | `FORGOT_PASSWORD_PATH` (`/forgot-password`) | [ForgotPassword](ForgotPassword.dc.html) |
| Onboarding 1, Home | `stepPath("home")` | [OnboardHome](OnboardHome.dc.html) |
| Onboarding 2, Baseline | `stepPath("baseline")` | [OnboardBaseline](OnboardBaseline.dc.html) |
| Onboarding 3, Restrictions | `stepPath("restrictions")` | [OnboardRestrictions](OnboardRestrictions.dc.html) |
| Onboarding 4, Preferences | `stepPath("preferences")` | [OnboardPreferences](OnboardPreferences.dc.html) |
| Onboarding 5, Reminders | `stepPath("reminders")` | [OnboardReminders](OnboardReminders.dc.html) |
| Invite, signed out | invite link (join dialog) | [InviteSignedOut](InviteSignedOut.dc.html) |
| Invite, rate the chores | invite link, after joining | [InviteRating](InviteRating.dc.html) |
| **Partes** | | |
| Bottom bar (shared by the four tabs) | | [BottomBar](BottomBar.dc.html) |
| TaskCard states and chore categories | | [Parts](Parts.dc.html) |

The onboarding order in the canvas (Home, Baseline, Restrictions, Preferences, Reminders, with no install step) differs from `ONBOARDING_STEPS` in `web/src/domains/onboarding/api/api.ts` (`install`, `reminders`, `baseline`, `restrictions`, `preferences`, `home`). The step ids are stored on the server, so changing the walk is the onboarding ticket's decision, not a rename.
