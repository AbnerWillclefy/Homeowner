import type { FakeApi } from "../api";
import { choresHandlers } from "./chores";
import { homeHandlers } from "./home";
import { onboardingHandlers } from "./onboarding";
import { photosHandlers } from "./photos";
import { residentsHandlers } from "./residents";
import { todayHandlers } from "./today";

/** Everything a signed-in Resident with a Home reads: the Profile, the Home, its Chores and the day. */
export function signedInHandlers(api: FakeApi): void {
  onboardingHandlers(api);
  homeHandlers(api);
  choresHandlers(api);
  todayHandlers(api);
  residentsHandlers(api);
  photosHandlers(api);
}
