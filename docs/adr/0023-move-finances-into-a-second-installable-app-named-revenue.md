# Move Finances into a second installable app named Revenue

Finances lives as a tab inside the Homeowner PWA, a phone-first app built for Residents sharing housework ([ADR 0005](0005-ship-a-react-pwa-not-a-native-app.md), [ADR 0009](0009-navigate-with-a-bottom-tab-router-and-amend-the-look.md)). Its approved design has 11 screens, is desktop first with a phone form, and is built on Bedrock ([ADR 0022](0022-a-shared-bedrock-design-system-amends-0007-and-0009-for-adopting-apps.md)). It is open only to Users on the finance allowlist, and its Bill reminders are push notifications. Putting all of that inside the PWA fights the PWA's density rules ([ADR 0007](0007-tailwind-and-radix-for-an-accessible-calm-ui.md)) and its bottom-tab navigation, and ships money screens to every Resident. The budget stays under $20 a month with nothing billing while idle ([ADR 0002](0002-mirror-the-work-stack.md)).

## Decision

- **A separate app.** Finances becomes Revenue: its own Vite + React PWA in `revenue/`, with its own manifest and service worker. It joins the npm workspace beside `bedrock/`, so React is shipped once, and it builds on Bedrock Core and `@homeowner/bedrock/finance`.
- **Its own address.** Each environment deploys Revenue to its own S3 bucket and CloudFront distribution on the default CloudFront domain, the same shape as `admin/` ([ADR 0017](0017-operate-through-a-separate-admin-app-per-environment.md)). Each API allows only its own environment's Revenue origin in CORS.
- **Shared identity and API.** Revenue signs in to the same Cognito pool with the same app client, offering sign-in and forgot password only, no sign-up. It calls the same API under `/me/finance`. A gate in the app mounts the screens only after `GET /me/finance` answers 200 and shows "no access" on 403. The control stays the API's finance allowlist; the gate only decides what the User sees.
- **Push per app.** A push subscription records which app it belongs to (`homeowner` or `revenue`). Bill reminders go only to Revenue's subscriptions; Homeowner's nudges go only to Homeowner's. One VAPID key pair serves both apps, since a subscription is already tied to its service worker's origin.
- **Finances leaves the PWA last.** The Homeowner PWA keeps its Finances tab until every Revenue screen ships; removing it is the epic's last ticket.

## Considered Options

- **A desktop layout inside the PWA:** one install and one sign-in, but desktop-first money screens fight 0007's density and 0009's bottom-tab navigation, and every Resident downloads code only allowlisted Users can use.
- **A second Cognito app client for Revenue:** a separate client id, but no access gain, because the allowlist on the API is the control and any client in the pool yields the same tokens. It adds Terraform and configuration to keep in step.
- **A second VAPID key pair:** no isolation gain, because subscriptions are already per origin; it doubles a secret to rotate.
- **Revenue outside the npm workspace, with its own lockfile like `admin/`:** simpler isolation, but two copies of React reach the app unless every consumer dedupes by hand (ADR 0022, Consequences).

## Consequences

- Users install and opt in to a second app: one more install, one more sign-in, and one more notification permission.
- Existing Finances users stop getting Bill reminders until they install Revenue and enable its notifications. This is deliberate and consistent with ADR 0005 (push is a best-effort nudge); the reminder switch ships with Revenue's push opt-in, not earlier.
- Three front ends deploy per environment (`web/`, `admin/`, `revenue/`), each with its own bucket, distribution, deploy workflow and smoke tests. They cost cents while idle.
- A User's session in Revenue is separate from Homeowner's: separate origins and a separate `localStorage` key, so signing out of one does not sign out of the other.
- The npm workspace now has an app in it, so changes to the root `package-lock.json` affect Revenue's build as well as Bedrock's.
- Removing Finances from the PWA is the hard-to-reverse step: bringing it back means restoring the tab, its routes and the bill push kinds in Homeowner's service worker. It lands only after Revenue covers every screen.
