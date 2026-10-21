import { refreshSession } from "./cognito";
import { browserSession } from "../logic/browserSession";
import { createTokenKeeper } from "../logic/tokenKeeper";

/** The app's one token keeper, shared by the fetch helper and the Axios client. */
export const browserKeeper = createTokenKeeper({
  session: browserSession,
  refresh: refreshSession,
  now: Date.now,
});
