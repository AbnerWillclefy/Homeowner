import { describe, expect, it, vi } from "vitest";
import { PINNED_SCRIPT, createPluggyConnect, pinnedScript, type PluggyOptions } from "./pluggyConnect";

const SCRIPT = { url: "https://cdn.example/p.js", integrity: "sha384-abc" };

/** A document that can append a script, and a window the script "defines" PluggyConnect on when it loads. */
function browser(outcome: "load" | "error" = "load") {
  const appended: Record<string, string>[] = [];
  const widget: { options?: PluggyOptions; init: ReturnType<typeof vi.fn> } = { init: vi.fn() };
  const win: { PluggyConnect?: new (options: PluggyOptions) => { init(): void } } = {};
  const doc = {
    createElement: () => {
      const attrs: Record<string, string> = {};
      return {
        attrs,
        setAttribute: (k: string, v: string) => void (attrs[k] = v),
        onload: null as null | (() => void),
        onerror: null as null | (() => void),
      };
    },
    head: {
      appendChild(el: { attrs: Record<string, string>; onload: () => void; onerror: () => void }) {
        appended.push(el.attrs);
        if (outcome === "load") {
          win.PluggyConnect = class {
            constructor(options: PluggyOptions) {
              widget.options = options;
            }
            init = widget.init;
          };
          el.onload();
        } else el.onerror();
      },
    },
  };
  return { doc: doc as never, win: win as never, appended, widget };
}

const OPTIONS: PluggyOptions = { connectToken: "tok", includeSandbox: true, onSuccess: () => undefined, onError: () => undefined, onClose: () => undefined };

describe("createPluggyConnect", () => {
  it("loads nothing until it is opened", () => {
    const b = browser();
    createPluggyConnect(b.doc, b.win, SCRIPT);
    expect(b.appended).toEqual([]);
  });

  it("adds the pinned script with integrity and crossorigin, then starts the widget with the options", async () => {
    const b = browser();
    const connect = createPluggyConnect(b.doc, b.win, SCRIPT);
    await connect(OPTIONS);
    expect(b.appended).toEqual([{ src: SCRIPT.url, integrity: SCRIPT.integrity, crossorigin: "anonymous" }]);
    expect(b.widget.options).toEqual(OPTIONS);
    expect(b.widget.init).toHaveBeenCalledTimes(1);
  });

  it("loads the script once for any number of opens", async () => {
    const b = browser();
    const connect = createPluggyConnect(b.doc, b.win, SCRIPT);
    await connect(OPTIONS);
    await connect(OPTIONS);
    expect(b.appended).toHaveLength(1);
    expect(b.widget.init).toHaveBeenCalledTimes(2);
  });

  it("rejects when the script cannot load, and tries again on the next open", async () => {
    const b = browser("error");
    const connect = createPluggyConnect(b.doc, b.win, SCRIPT);
    await expect(connect(OPTIONS)).rejects.toThrow();
    await expect(connect(OPTIONS)).rejects.toThrow();
    expect(b.appended).toHaveLength(2);
  });
});

describe("pinnedScript", () => {
  it("is the ADR 0019 version and hash unless a build overrides both", () => {
    expect(pinnedScript({})).toEqual(PINNED_SCRIPT);
    expect(PINNED_SCRIPT.url).toBe("https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js");
    expect(PINNED_SCRIPT.integrity).toBe("sha384-EfJtVYPBw2vssrS8cou8sSUccnxm72OwXqa4V+b1injWH0avP4mtCJr2XM6Sb2/7");
    expect(pinnedScript({ VITE_PLUGGY_CONNECT_URL: "https://x/y.js", VITE_PLUGGY_CONNECT_SRI: "sha384-z" })).toEqual({
      url: "https://x/y.js",
      integrity: "sha384-z",
    });
  });

  it("never takes a URL without a hash", () => {
    expect(pinnedScript({ VITE_PLUGGY_CONNECT_URL: "https://x/y.js" })).toEqual(PINNED_SCRIPT);
  });
});
