import { json, type FakeApi } from "../api";

/**
 * Makes `GET /boot` fail, so every launch read goes to its own endpoint, as it does when the boot is down. For specs
 * about one read at launch (held, failed or counted), which the boot would answer before they could act on it.
 */
export function withoutBoot(api: FakeApi): void {
  api.override("GET /boot", json(500, { error: "internal error" }));
}
