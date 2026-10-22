// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "./testing";
import { updateCached } from "./cacheUpdate";
import { useCachedData } from "./useCachedData";

const key = ["thing"] as const;

describe("useCachedData", () => {
  let rendered: Rendered | undefined;
  afterEach(() => rendered?.unmount());

  it("shows a cache write in the same call, with no timer in between", () => {
    const client = createTestQueryClient();
    client.setQueryData(key, { n: 1 });
    let seen: { n: number } | undefined;
    const Probe = () => {
      seen = useCachedData<{ n: number }>(key);
      return null;
    };
    rendered = renderWithQueryClient(createElement(Probe), client);
    expect(seen).toEqual({ n: 1 });
    act(() => updateCached(client, key, (v: { n: number }) => ({ n: v.n + 1 })));
    expect(seen).toEqual({ n: 2 });
  });
});
