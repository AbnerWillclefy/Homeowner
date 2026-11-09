import type { VoiceMessage } from "../hooks/useVoice";

/** What a browser speech error code means for the panel; only `service-not-allowed` also takes the mic away. */
export function speechError(code: string): { message: VoiceMessage; hideMic: boolean } {
  switch (code) {
    case "service-not-allowed":
      return { message: "device", hideMic: true };
    case "not-allowed":
      return { message: "permission", hideMic: false };
    case "no-speech":
    case "aborted":
      return { message: "nothing", hideMic: false };
    default:
      // network, audio-capture and any code not known: ask to try again.
      return { message: "error", hideMic: false };
  }
}
