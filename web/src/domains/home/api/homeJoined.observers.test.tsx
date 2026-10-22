// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { dayPlan } from "../../dayplan/testing/fixtures";
import { resident } from "../../residents/testing/fixtures";
import type { DayPlanResult } from "../../dayplan/api/api";
import type { ResidentsResult } from "../../residents/api/api";

const getDayPlan = vi.fn<() => Promise<DayPlanResult>>();
const getResidents = vi.fn<() => Promise<ResidentsResult>>();
vi.mock("../../dayplan/api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDayPlan: () => getDayPlan(),
}));
vi.mock("../../residents/api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getResidents: () => getResidents(),
}));

const { homeJoined } = await import("./queries");
const { dayPlanKey } = await import("../../dayplan/api/queries");
const { residentsKey } = await import("../../residents/api/queries");
const { useDayPlan } = await import("../../dayplan/hooks/useDayPlan");
const { useResidents } = await import("../../residents/hooks/useResidents");

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("joining a Home while the Shell's observers are mounted", () => {
  let rendered: Rendered | undefined;
  let day!: ReturnType<typeof useDayPlan>;
  let residents!: ReturnType<typeof useResidents>;
  const OLD_HOME = [resident("r1", "Ana")];
  const NEW_HOME = [resident("r9", "Bruna")];
  beforeEach(() => {
    getDayPlan.mockReset();
    getResidents.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("makes each observer read again and end ready with the new Home's data", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, dayPlan({ energy: 3 }));
    client.setQueryData(residentsKey, OLD_HOME);
    getDayPlan.mockResolvedValue({ kind: "ok", plan: dayPlan({ energy: 8 }) });
    getResidents.mockResolvedValue({ kind: "ok", date: "2030-01-15", residents: NEW_HOME });
    rendered = renderWithQueryClient(
      createElement(() => {
        day = useDayPlan();
        residents = useResidents(true);
        return null;
      }),
      client,
    );
    await settle();
    getDayPlan.mockClear();
    getResidents.mockClear();

    await act(() => homeJoined(client));
    await settle();

    expect(getDayPlan).toHaveBeenCalledTimes(1);
    expect(getResidents).toHaveBeenCalledTimes(1);
    expect(residents.state).toEqual({ kind: "ready", residents: NEW_HOME });
    expect(day.state).toMatchObject({ kind: "ready", plan: { energy: 8 } });
  });
});
