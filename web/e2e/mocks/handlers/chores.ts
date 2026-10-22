import type { Chore, ChoreWire } from "../../../src/domains/chores/api/api";
import { empty, fieldErrors, json, signedIn, type FakeApi, type FakeState } from "../api";
import { choreErrors } from "./home";

/** The stored Chore for a valid body, as `POST /home` stores one. */
function stored(id: string, chore: ChoreWire): Chore {
  return {
    id,
    name: chore.name.trim(),
    category: chore.category,
    demands: [...new Set(chore.demands)].sort(),
    baseEffort: chore.baseEffort,
    importance: chore.importance,
    people: chore.people,
    intervalDays: typeof chore.intervalDays === "number" ? chore.intervalDays : null,
    allowedWeekdays: [...new Set(chore.allowedWeekdays)].sort((a, b) => a - b),
    buildsUp: chore.buildsUp,
  };
}

const noHome = (state: FakeState) => state.home === null;

/** What the Chores tab reads and writes: the Home's stored Chores. Needs a Home, like the API (404 without one). */
export function choresHandlers(api: FakeApi): void {
  api.on("GET /home/chores", signedIn((_, state) => (noHome(state) ? json(404, { error: "no home" }) : json(200, { chores: state.chores }))));

  api.on(
    "POST /home/chores",
    signedIn((request, state) => {
      if (noHome(state)) return json(404, { error: "no home" });
      const fields = choreErrors(request.body, state);
      if (Object.keys(fields).length > 0) return fieldErrors(fields);
      const next = state.chores.reduce((max, c) => Math.max(max, Number(c.id.replace(/\D/g, "")) || 0), 0) + 1;
      const chore = stored(`chore-${next}`, request.body as ChoreWire);
      state.chores.push(chore);
      return json(201, chore);
    }),
  );

  api.on(
    "PUT /home/chores/{id}",
    signedIn((request, state) => {
      const index = state.chores.findIndex((c) => c.id === request.params["id"]);
      if (noHome(state) || index < 0) return json(404, { error: "no chore" });
      const fields = choreErrors(request.body, state);
      if (Object.keys(fields).length > 0) return fieldErrors(fields);
      const chore = stored(state.chores[index]!.id, request.body as ChoreWire);
      state.chores[index] = chore;
      return json(200, chore);
    }),
  );

  api.on(
    "DELETE /home/chores/{id}",
    signedIn((request, state) => {
      const index = state.chores.findIndex((c) => c.id === request.params["id"]);
      if (noHome(state) || index < 0) return json(404, { error: "no chore" });
      state.chores.splice(index, 1);
      return empty(204);
    }),
  );
}
