import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "../../../shared/i18n";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { savePhoto } from "../api/cacheWrites";
import { confirmUpload, putToStorage, removePhoto, requestUpload } from "../api/photoApi";
import { preparePhoto } from "../logic/browserImage";

/**
 * idle -> preparing -> previewing -> saving -> done (back to idle with the new photo) or failed.
 * The prepared blob lives in `previewing`, `saving` and `failed`, so Retry starts again from "ask" without
 * choosing again: a presigned URL lasts five minutes, so a new one is always asked for, never reused.
 */
type PhotoState =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "previewing"; blob: Blob; previewUrl: string }
  | { kind: "saving"; blob: Blob; previewUrl: string }
  | { kind: "failed"; blob: Blob; previewUrl: string; problem: MessageKey };

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
 * leaves `me` as it was. On success the `me` cache gets the new URL via `savePhoto` (the Me header and Today change
 * with no reload) and the Residents are marked stale. Preview URLs are revoked when they are replaced and on
 * unmount.
 */
export function usePhotoUpload() {
  const queryClient = useQueryClient();
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
    const fail = (kind: Failed["kind"]) => setState({ kind: "failed", blob, previewUrl, problem: PROBLEM_KEY[kind] });

    setState({ kind: "saving", blob, previewUrl });
    const asked = await requestUpload(blob.type, blob.size);
    if (asked.kind !== "ok") return fail(asked.kind);

    const put = await putToStorage(asked.upload, blob);
    if (put.kind !== "ok") return fail(put.kind);

    const confirmed = await confirmUpload(asked.upload.key);
    if (confirmed.kind !== "ok") return fail(confirmed.kind);

    const { photoUrl } = confirmed;
    await savePhoto(queryClient, photoUrl);
    setState({ kind: "idle" });
  });

  const remove = useSubmitOnce(async () => {
    setProblem(null);
    const result = await removePhoto();
    if (result.kind !== "ok") {
      setProblem(result.kind === "photos-off" ? "profile.photo.off" : "profile.photo.removeError");
      return;
    }
    await savePhoto(queryClient, null);
  });

  return {
    /** The photo being previewed or saved, or null. */
    preview: url === null ? null : { previewUrl: url },
    preparing: state.kind === "preparing",
    saving: state.kind === "saving",
    /** A save failed: the preview stays and the button says Retry. */
    failed: state.kind === "failed",
    /** The one message to show: why a save failed, or why a choice or a removal did not work. */
    message: state.kind === "failed" ? state.problem : problem,
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
