# Ship a React PWA, not a native app

The Residents' app is a React progressive web app installed to the Home Screen, not a native mobile app. Native iOS distribution and push notifications need a paid Apple Developer account ($99/year), which alone would have been most of this project's budget, while Home Screen web apps get Web Push on iOS 16.4+ for free. Push is sent as standard Web Push straight from Go with VAPID keys, no FCM.

## Considered Options

- **Flutter** (the work stack): dropped, since its strength is native and we no longer ship native.
- **Expo + React Native Web**: would make a later native port free of rewrites, but practises React Native instead of the React-for-web used at work. A future native port keeps the TypeScript logic and API client and rewrites only the screens.

## Consequences

iOS Web Push is unreliable (subscriptions lapse silently; installs are manual via Share → Add to Home Screen), so push is only ever a nudge: the app re-subscribes on every launch and asks for the Check-in whenever it opens, and Allocation falls back to the Baseline for anyone who did not check in.
