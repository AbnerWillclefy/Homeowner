import { useEffect, useRef, useState } from "react";
import { useShell } from "../../../app/components/ShellContext";
import type { MessageKey } from "../../../shared/i18n";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { Me } from "../../auth/api/meApi";
import { confirmUpload, putToStorage, removePhoto, requestUpload } from "../api/photoApi";
import { preparePhoto } from "../logic/browserImage";

export type SaveStep = "ask" | "put" | "confirm";

/**
 * idle -> preparing -> previewing -> saving(step) -> done (back to idle with the new photo) or failed(step).
 * The prepared blob lives in `previewing`, `saving` and `failed`, so Retry starts again from "ask" without
 * choosing again: a presigned URL lasts five minutes, so a new one is always asked for, never reused.
 */
export type PhotoState =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "previewing"; blob: Blob; previewUrl: string }
  | { kind: "saving"; blob: Blob; previewUrl: string; step: SaveStep }
  | { kind: "failed"; blob: Blob; previewUrl: string; step: SaveStep; problem: MessageKey };

type Failed = { kind: "photos-off" | "offline" | "error" | "not-signed-in" };

const PROBLEM_KEY: Record<Failed["kind"], MessageKey> = {
  "photos-off": "profile.photo.off",
  offline: "profile.photo.offline",
  error: "profile.photo.error",
  "not-signed-in": "profile.photo.notSignedIn",
};

/** The blob and URL of the photo being previewed or saved, or null. */
function previewOf(state: PhotoState): { blob: Blob; previewUrl: string } | null {
  return "blob" in state ? state : null;
}

/**
 * The photo area of the edit screen. Nothing is sent before Save. Save asks for an upload, puts the photo in
 * storage and confirms it; the current photo changes only when the confirm answers 200, so a failure at any step
 * leaves `me` as it was. On success the User gets the new URL through the shell (the Me header and Today change
 * with no reload) and the Residents list is refreshed. Preview URLs are revoked when they are replaced and on
 * unmount.
 */
export function usePhotoUpload(me: Me) {
  const shell = useShell();
  const [state, setState] = useState<PhotoState>({ kind: "idle" });
  /** Why a choice or a removal did not work; the current photo is untouched. */
  const [problem, setProblem] = useState<MessageKey | null>(null);
  // The newest choice wins: a slow preparation never replaces a later one.
  const latest = useRef(0);

  const url = previewOf(state)?.previewUrl ?? null;
  useEffect(() => {
    if (url === null) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  useEffect(
    () => () => {
      latest.current += 1;
    },
    [],
  );

  async function choose(file: File) {
    const mine = ++latest.current;
    setProblem(null);
    setState({ kind: "preparing" });
    const result = await preparePhoto(file);
    if (mine !== latest.current) return;
    if (result.kind === "ok") {
      setState({ kind: "previewing", blob: result.blob, previewUrl: URL.createObjectURL(result.blob) });
      return;
    }
    // Nothing was sent and `me.photoUrl` is untouched, so the current photo stays.
    setState({ kind: "idle" });
    setProblem(result.kind === "unreadable" ? "profile.photo.unreadable" : "profile.photo.unprepared");
  }

  const save = useSubmitOnce(async () => {
    const prepared = previewOf(state);
    if (prepared === null) return;
    const { blob, previewUrl } = prepared;
    const fail = (step: SaveStep, kind: Failed["kind"]) =>
      setState({ kind: "failed", blob, previewUrl, step, problem: PROBLEM_KEY[kind] });

    setState({ kind: "saving", blob, previewUrl, step: "ask" });
    const asked = await requestUpload(blob.type, blob.size);
    if (asked.kind !== "ok") return fail("ask", asked.kind);

    setState({ kind: "saving", blob, previewUrl, step: "put" });
    const put = await putToStorage(asked.upload, blob);
    if (put.kind !== "ok") return fail("put", put.kind);

    setState({ kind: "saving", blob, previewUrl, step: "confirm" });
    const confirmed = await confirmUpload(asked.upload.key);
    if (confirmed.kind !== "ok") return fail("confirm", confirmed.kind);

    shell.me.set({ ...me, photoUrl: confirmed.photoUrl });
    shell.residents.reload();
    setState({ kind: "idle" });
  });

  const remove = useSubmitOnce(async () => {
    setProblem(null);
    const result = await removePhoto();
    if (result.kind !== "ok") {
      setProblem(result.kind === "photos-off" ? "profile.photo.off" : "profile.photo.removeError");
      return;
    }
    shell.me.set({ ...me, photoUrl: null });
    shell.residents.reload();
  });

  return {
    state,
    problem,
    choose(file: File) {
      void choose(file);
    },
    save() {
      void save.run();
    },
    remove() {
      void remove.run();
    },
    removing: remove.pending,
    /** Choosing, saving and removing are exclusive: while one runs the others are off. */
    busy: state.kind === "preparing" || state.kind === "saving" || remove.pending,
  };
}
