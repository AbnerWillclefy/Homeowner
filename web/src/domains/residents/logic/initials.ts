const SEPARATORS = /[\s._\-+]+/;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstGrapheme(word: string): string {
  const first = segmenter.segment(word)[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment;
}

/**
 * The letters shown on an initials Avatar, from the shown name only (the server already turned a missing name
 * into the email's local part, and the app never receives another Resident's email). Two or more words give the
 * first letter of the first and of the last word; one word gives its first letter only. Letters are graphemes,
 * so an accented letter or an emoji is never cut in half. An empty name gives "" and the Avatar draws an icon.
 */
export function initials(name: string): string {
  const words = name.split(SEPARATORS).filter((word) => word !== "");
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return "";
  const letters = words.length === 1 ? firstGrapheme(first) : firstGrapheme(first) + firstGrapheme(last);
  return letters.toLocaleUpperCase();
}
