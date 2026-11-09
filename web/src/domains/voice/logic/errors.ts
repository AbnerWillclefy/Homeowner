import type { VoiceMessage } from "../hooks/useVoice";

/** What a browser speech error code means for the panel. */
export function speechError(code: string): VoiceMessage {
  switch (code) {
    case "service-not-allowed":
      return "device";
    case "not-allowed":
      return "permission";
    case "no-speech":
    case "aborted":
      return "nothing";
    default:
      // network, audio-capture and any code not known: ask to try again.
      return "error";
  }
}
