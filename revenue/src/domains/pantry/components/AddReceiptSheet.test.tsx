import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../../testing";
import * as api from "../api";
import type { PantryItem, Receipt, ReceiptLine } from "../api";
import { CHECKED_KEY, writeChecked } from "../logic/checked";
import { HIDE_VALUES_STORAGE_KEY, HideValuesProvider } from "../../../shared/HideValues";
import { AddReceiptSheet } from "./AddReceiptSheet";

// jsdom lacks these; Radix reads them.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock("jsqr", () => ({ default: vi.fn() }));
vi.mock("../api", async (original) => ({ ...(await original<typeof import("../api")>()), getPantry: vi.fn(), addReceipt: vi.fn(), matchLine: vi.fn() }));

const { default: jsQR } = await import("jsqr");

const item = (id: string, name: string, brand: string | null = null): PantryItem => ({ id, name, preferredBrand: brand, fixed: false, state: "in_stock", ranOutOn: null });
const RICE = item("p1", "Arroz", "Tio João");
const COFFEE = item("p2", "Café");
const line = (n: number, over: Partial<ReceiptLine> = {}): ReceiptLine => ({ n, description: `PRODUTO ${n}`, quantityMilli: 1000, unit: "UN", unitPriceCents: 2790, totalCents: 2790, itemId: null, ignored: false, ...over });
const receipt = (lines: ReceiptLine[]): Receipt => ({ id: "r1", storeName: "Bom Preço", issuedOn: "2030-01-02", totalCents: 5580, readBy: "sefaz", lines });
const TWO = receipt([line(1, { itemId: "p9" }), line(2), line(3)]);
const KEY = "35241112345678000123650010000012341000012345";

const add = vi.mocked(api.addReceipt);
const match = vi.mocked(api.matchLine);
const pantry = vi.mocked(api.getPantry);

/** Opens the Sheet on the wide layout (a Radix dialog), in English unless told otherwise. */
async function open(options: Parameters<typeof renderApp>[1] = {}) {
  const view = renderApp(<HideValuesProvider><AddReceiptSheet /></HideValuesProvider>, { locale: "en", ...options });
  await userEvent.click(screen.getByRole("button", { name: /Add receipt|Adicionar nota/ }));
  return view;
}
async function paste(text = KEY) {
  await userEvent.click(await screen.findByRole("button", { name: "Paste the key" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Access key or link" }), text);
  await userEvent.click(screen.getByRole("button", { name: "Get receipt" }));
}
const onMatching = async (r = TWO) => {
  add.mockResolvedValue({ kind: "created", receipt: r });
  await open();
  await paste();
  await screen.findByText("PRODUTO 2");
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  for (const fn of [add, match, pantry, vi.mocked(jsQR)]) fn.mockReset();
  pantry.mockResolvedValue([RICE, COFFEE]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("choose and paste", () => {
  it("offers scan and paste, and the photo option as coming soon", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Scan receipt QR" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paste the key" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Take photo/ }).hasAttribute("disabled")).toBe(true);
  });

  it("saves a pasted code trimmed and lists only the unmatched lines, with progress", async () => {
    add.mockResolvedValue({ kind: "created", receipt: TWO });
    await open();
    await paste(`  ${KEY}  `);
    expect(add).toHaveBeenCalledWith(KEY);
    expect(await screen.findByText("PRODUTO 2")).toBeTruthy();
    expect(screen.queryByText("PRODUTO 1")).toBeNull();
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("1 un")).toBeTruthy();
  });

  it("says in pt-BR how far along the matching is", async () => {
    add.mockResolvedValue({ kind: "created", receipt: TWO });
    await open({ locale: "pt-BR" });
    await userEvent.click(screen.getByRole("button", { name: "Colar a chave" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Chave de acesso ou link" }), KEY);
    await userEvent.click(screen.getByRole("button", { name: "Buscar nota" }));
    expect(await screen.findByText("1 de 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Não é da despensa" })).toBeTruthy();
  });

  it("shows a refused code under the field and keeps what was typed", async () => {
    add.mockResolvedValue({ kind: "invalid" });
    await open();
    await paste("123");
    expect(await screen.findByText("That key does not look right. Check the 44 digits.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Access key or link" }) as HTMLInputElement).value).toBe("123");
  });

  it("shows a failed read above the field and keeps what was typed", async () => {
    add.mockResolvedValue({ kind: "error" });
    await open();
    await paste("123");
    expect(await screen.findByText("Couldn't read the receipt. Try again.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Access key or link" }) as HTMLInputElement).value).toBe("123");
  });
});

describe("the end of a receipt", () => {
  it("goes straight to done when every line is matched, counting the items", async () => {
    add.mockResolvedValue({ kind: "created", receipt: receipt([line(1, { itemId: "p1" }), line(2, { itemId: "p2" })]) });
    await open();
    await paste();
    expect(await screen.findByText("All recognised")).toBeTruthy();
    expect(screen.getByText("2 items updated.")).toBeTruthy();
  });

  it("shows a repeated receipt with nothing left as already added, not as an error", async () => {
    add.mockResolvedValue({ kind: "duplicate", receipt: receipt([line(1, { itemId: "p1" })]) });
    await open();
    await paste();
    expect(await screen.findByText("Receipt already added")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resumes a repeated receipt that still has lines to match", async () => {
    add.mockResolvedValue({ kind: "duplicate", receipt: TWO });
    await open();
    await paste();
    expect(await screen.findByText("PRODUTO 2")).toBeTruthy();
  });

  it.each([["502 sefaz_unavailable"], ["422 unsupported_state"]])("explains %s and offers the photo", async () => {
    add.mockResolvedValue({ kind: "unavailable" });
    await open();
    await paste();
    expect(await screen.findByText("Couldn't read it from SEFAZ. Take a photo of the receipt.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take photo" }).hasAttribute("disabled")).toBe(false);
  });

  it("lets the User try again from the paste step after SEFAZ fails", async () => {
    add.mockResolvedValue({ kind: "unavailable" });
    await open();
    await paste();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(screen.getByRole("textbox", { name: "Access key or link" })).toBeTruthy();
  });
});

describe("matching a line", () => {
  it("matches to an existing item, filtered by the search, and moves on", async () => {
    await onMatching();
    match.mockResolvedValue({ kind: "ok", receipt: receipt([line(1, { itemId: "p9" }), line(2, { itemId: "p2" }), line(3)]) });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search the pantry" }), "cafe");
    expect(screen.queryByRole("button", { name: /Choose Arroz/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Choose Café" }));
    expect(match).toHaveBeenCalledWith("r1", 2, { itemId: "p2" });
    expect(await screen.findByText("PRODUTO 3")).toBeTruthy();
    expect(screen.getByText("2 of 2")).toBeTruthy();
  });

  it("creates a new item with a name and brand", async () => {
    await onMatching();
    match.mockResolvedValue({ kind: "ok", receipt: receipt([line(1, { itemId: "p9" }), line(2, { itemId: "n1" }), line(3)]) });
    await userEvent.click(screen.getByRole("button", { name: "New item" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Item name" }), " Macarrão ");
    await userEvent.type(screen.getByRole("textbox", { name: "Brand" }), "Barilla");
    await userEvent.click(screen.getByRole("button", { name: "Create and use" }));
    expect(match).toHaveBeenCalledWith("r1", 2, { newItem: { name: "Macarrão", brand: "Barilla" } });
    expect(await screen.findByText("PRODUTO 3")).toBeTruthy();
  });

  it("sends no brand when none was typed, and checks the name before sending", async () => {
    await onMatching();
    match.mockResolvedValue({ kind: "ok", receipt: TWO });
    await userEvent.click(screen.getByRole("button", { name: "New item" }));
    await userEvent.click(screen.getByRole("button", { name: "Create and use" }));
    expect(await screen.findByText("Give the item a name.")).toBeTruthy();
    expect(match).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: "Item name" }), "Sal");
    await userEvent.click(screen.getByRole("button", { name: "Create and use" }));
    expect(match).toHaveBeenCalledWith("r1", 2, { newItem: { name: "Sal", brand: null } });
  });

  it("shows a taken name under the field and keeps the form", async () => {
    await onMatching();
    match.mockResolvedValue({ kind: "fields", fields: { name: "taken" } });
    await userEvent.click(screen.getByRole("button", { name: "New item" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Item name" }), "Arroz");
    await userEvent.click(screen.getByRole("button", { name: "Create and use" }));
    expect(await screen.findByText("An item with this name already exists.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Item name" }) as HTMLInputElement).value).toBe("Arroz");
  });

  it("marks a line as not a pantry item, and finishes after the last one", async () => {
    await onMatching();
    match.mockResolvedValueOnce({ kind: "ok", receipt: receipt([line(1, { itemId: "p9" }), line(2, { ignored: true }), line(3)]) });
    await userEvent.click(screen.getByRole("button", { name: "Not a pantry item" }));
    expect(match).toHaveBeenCalledWith("r1", 2, { ignore: true });
    await screen.findByText("PRODUTO 3");
    match.mockResolvedValueOnce({ kind: "ok", receipt: receipt([line(1, { itemId: "p9" }), line(2, { ignored: true }), line(3, { itemId: "p1" })]) });
    await userEvent.click(screen.getByRole("button", { name: "Choose Arroz, Tio João" }));
    expect(match).toHaveBeenLastCalledWith("r1", 3, { itemId: "p1" });
    expect(await screen.findByText("All recognised")).toBeTruthy();
    expect(screen.getByText("2 items updated.")).toBeTruthy();
  });

  it("stays on the line with an error inside the Sheet when the write fails", async () => {
    await onMatching();
    match.mockResolvedValue({ kind: "error" });
    await userEvent.click(screen.getByRole("button", { name: "Not a pantry item" }));
    expect(await screen.findByText("We could not save this line. Try again.")).toBeTruthy();
    expect(screen.getByText("PRODUTO 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not a pantry item" }).hasAttribute("disabled")).toBe(false);
  });

  it("disables every choice while a write is in flight", async () => {
    await onMatching();
    let finish!: (r: api.MatchResult) => void;
    match.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await userEvent.click(screen.getByRole("button", { name: "Not a pantry item" }));
    expect(screen.getByRole("button", { name: "Not a pantry item" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Choose Café" }).hasAttribute("disabled")).toBe(true);
    await act(async () => finish({ kind: "error" }));
  });

  it("refreshes the Pantry after each match and after the receipt is saved", async () => {
    await onMatching();
    const reads = pantry.mock.calls.length;
    match.mockResolvedValue({ kind: "ok", receipt: receipt([line(1, { itemId: "p9" }), line(2, { ignored: true }), line(3)]) });
    await userEvent.click(screen.getByRole("button", { name: "Not a pantry item" }));
    await waitFor(() => expect(pantry.mock.calls.length).toBeGreaterThan(reads));
  });

  it("hides the line's price when values are hidden", async () => {
    localStorage.setItem(HIDE_VALUES_STORAGE_KEY, "1");
    await onMatching();
    expect(screen.queryByText(/27,90|27\.90/)).toBeNull();
  });
});

describe("check-offs", () => {
  it("clears them when a receipt is created", async () => {
    writeChecked(["p1"]);
    add.mockResolvedValue({ kind: "created", receipt: TWO });
    await open();
    await paste();
    await screen.findByText("PRODUTO 2");
    expect(localStorage.getItem(CHECKED_KEY)).toBeNull();
  });

  it("keeps them when the receipt was already added", async () => {
    writeChecked(["p1"]);
    add.mockResolvedValue({ kind: "duplicate", receipt: TWO });
    await open();
    await paste();
    await screen.findByText("PRODUTO 2");
    expect(JSON.parse(localStorage.getItem(CHECKED_KEY)!)).toEqual(["p1"]);
  });
});

describe("the camera", () => {
  const track = () => ({ stop: vi.fn() });
  // jsdom has no `navigator.mediaDevices`; define it on the instance and take it away after each test.
  const setDevices = (value: unknown) => Object.defineProperty(navigator, "mediaDevices", { value, configurable: true });
  afterEach(() => Reflect.deleteProperty(navigator, "mediaDevices"));
  function camera(tracks = [track()]) {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => tracks });
    setDevices({ getUserMedia });
    // jsdom has no video or canvas: a 640x480 frame and a 2d context that draws nothing.
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 640, height: 480 }) } as unknown as CanvasRenderingContext2D);
    return { getUserMedia, tracks };
  }
  afterEach(() => vi.restoreAllMocks());

  it("asks for the back camera, sends the decoded text to addReceipt and stops its tracks", async () => {
    const { getUserMedia, tracks } = camera();
    vi.mocked(jsQR).mockReturnValue({ data: KEY } as ReturnType<typeof jsQR>);
    add.mockResolvedValue({ kind: "created", receipt: TWO });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Scan receipt QR" }));
    expect(await screen.findByText("PRODUTO 2")).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" } });
    expect(add).toHaveBeenCalledWith(KEY);
    expect(tracks[0]!.stop).toHaveBeenCalled();
  });

  it("keeps looking while nothing decodes, and stops the tracks when the Sheet closes", async () => {
    const { tracks } = camera();
    vi.mocked(jsQR).mockReturnValue(null);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Scan receipt QR" }));
    await waitFor(() => expect(jsQR).toHaveBeenCalled());
    expect(screen.getByText("Point at the receipt QR code.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paste the key" })).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
    expect(tracks[0]!.stop).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(tracks[0]!.stop).toHaveBeenCalled();
  });

  it("offers paste with a message when the camera is denied", async () => {
    setDevices({ getUserMedia: vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError")) });
    add.mockResolvedValue({ kind: "created", receipt: TWO });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Scan receipt QR" }));
    expect(await screen.findByText("No camera access. Paste the key here.")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Access key or link" }), KEY);
    await userEvent.click(screen.getByRole("button", { name: "Get receipt" }));
    expect(await screen.findByText("PRODUTO 2")).toBeTruthy();
  });

  it("offers paste when there is no camera API at all", async () => {
    setDevices(undefined);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Scan receipt QR" }));
    expect(await screen.findByText("No camera access. Paste the key here.")).toBeTruthy();
  });

  it("stops a stream that arrives after the Sheet was closed", async () => {
    let grant!: (s: MediaStream) => void;
    const stop = vi.fn();
    setDevices({ getUserMedia: () => new Promise((resolve) => (grant = resolve)) });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Scan receipt QR" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(async () => grant({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    expect(stop).toHaveBeenCalled();
  });
});

describe("closing", () => {
  it("starts again at the choice when reopened, and gives focus back to its button", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Paste the key" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    const opener = screen.getByRole("button", { name: "Add receipt" });
    await waitFor(() => expect(document.activeElement).toBe(opener));
    await userEvent.click(opener);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Scan receipt QR" })).toBeTruthy();
  });
});
