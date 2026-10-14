import { describe, expect, it, vi } from "vitest";
import { inviteLink, shareInvite } from "./share";

describe("inviteLink", () => {
  it("puts the token in the fragment of the app's address", () => {
    expect(inviteLink("https://app.example.com", "tok-1")).toBe("https://app.example.com/#invite=tok-1");
  });
});

describe("shareInvite", () => {
  const message = { title: "Join my Home", text: "Join my Home on Homeowner", url: "https://x/#invite=t" };

  it("uses the share sheet when there is one", async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    expect(await shareInvite(message, { share, writeText })).toBe("shared");
    expect(share).toHaveBeenCalledWith(message);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does nothing more when the person closes the share sheet", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("closed", "AbortError");
    });
    const writeText = vi.fn(async () => {});
    expect(await shareInvite(message, { share, writeText })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when sharing is unavailable or fails", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareInvite(message, { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(message.url);
    const share = vi.fn(async () => {
      throw new Error("not allowed");
    });
    expect(await shareInvite(message, { share, writeText })).toBe("copied");
  });

  it("fails when there is neither a share sheet nor a clipboard that works", async () => {
    expect(await shareInvite(message, {})).toBe("failed");
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    expect(await shareInvite(message, { writeText })).toBe("failed");
  });
});
