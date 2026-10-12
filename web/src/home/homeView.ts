import type { HomeState } from "./useHome";

export type HomeView = "loading" | "failed" | "create" | "ready";

/**
 * What a Home-dependent tab shows for the Home's state. While an Invite is pending a missing Home shows as
 * loading, never the create form: joining is how this person gets a Home, so they never create one.
 */
export function homeView(state: HomeState, hasPendingInvite: boolean): HomeView {
  switch (state.kind) {
    case "loading":
      return "loading";
    case "failed":
      return "failed";
    case "none":
      return hasPendingInvite ? "loading" : "create";
    case "ready":
      return "ready";
  }
}
