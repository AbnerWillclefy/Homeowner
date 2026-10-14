/**
 * Wraps an async loader so only the newest call's result is delivered: a call that resolves after a newer one
 * started is dropped, so a slow old response can never overwrite a fresher one.
 */
export function latestOnly<T>(load: () => Promise<T>, deliver: (result: T) => void): () => Promise<void> {
  let latest = 0;
  return async () => {
    const id = ++latest;
    const result = await load();
    if (id === latest) deliver(result);
  };
}
