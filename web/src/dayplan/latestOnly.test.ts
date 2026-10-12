import { describe, expect, it } from "vitest";
import { latestOnly } from "./latestOnly";

describe("latestOnly", () => {
  it("drops an older call that resolves after a newer one", async () => {
    const resolvers: ((value: string) => void)[] = [];
    const delivered: string[] = [];
    const run = latestOnly(
      () => new Promise<string>((resolve) => resolvers.push(resolve)),
      (value) => delivered.push(value),
    );

    const first = run();
    const second = run();
    resolvers[1]("second");
    resolvers[0]("first");
    await Promise.all([first, second]);

    expect(delivered).toEqual(["second"]);
  });

  it("delivers a lone call", async () => {
    const delivered: string[] = [];
    await latestOnly(
      async () => "only",
      (value) => delivered.push(value),
    )();
    expect(delivered).toEqual(["only"]);
  });
});
