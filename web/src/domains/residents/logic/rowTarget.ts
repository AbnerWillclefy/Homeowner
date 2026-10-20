import { ME_PATH, residentPath } from "../../../app/logic/routes";
import type { Resident } from "../api/api";

/** Where a row of the Residents card goes: the caller's own row opens Me, any other opens that Resident's page. */
export function rowTarget({ id, you }: Pick<Resident, "id" | "you">): string {
  return you ? ME_PATH : residentPath(id);
}
