import { useEffect } from "react";

/** A page that a later ticket fills in. Sets the document title so the page change is announced. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  useEffect(() => {
    document.title = `${title} · Homeowner admin`;
  }, [title]);
  return (
    <>
      <h1>{title}</h1>
      <p className="text-sm text-muted">{note}</p>
    </>
  );
}
