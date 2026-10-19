/**
 * The sections of a page that are loading, after one of them reports. Returns the same set when the report
 * changes nothing, so React skips the render.
 */
export function withReport(loading: ReadonlySet<string>, id: string, isLoading: boolean): ReadonlySet<string> {
  if (loading.has(id) === isLoading) return loading;
  const next = new Set(loading);
  if (isLoading) next.add(id);
  else next.delete(id);
  return next;
}
