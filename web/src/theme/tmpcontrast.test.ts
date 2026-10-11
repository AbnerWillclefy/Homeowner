import { it } from "vitest";

const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const cr = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x! + 0.05) / (y! + 0.05)).toFixed(2);
};
const T: Record<string, Record<string, string>> = {
  light: { surface: "#f7f8f5", raised: "#ffffff", text: "#1c2421", muted: "#4d5a54", accent: "#2f6f4f", ac: "#ffffff", danger: "#b3261e", focus: "#1a5fb4", border: "#6b7a73" },
  dark: { surface: "#121816", raised: "#1b2320", text: "#e8eeea", muted: "#a9b5ae", accent: "#6fcf9f", ac: "#0b1a12", danger: "#ff8a80", focus: "#8ab4f8", border: "#7f8d86" },
};
it("c", () => {
  const out: string[] = [];
  for (const [n, t] of Object.entries(T)) {
    for (const [a, b] of [["text", "surface"], ["text", "raised"], ["muted", "surface"], ["muted", "raised"], ["accent", "surface"], ["accent", "raised"], ["ac", "accent"], ["danger", "surface"], ["danger", "raised"], ["focus", "surface"], ["focus", "raised"], ["border", "surface"], ["border", "raised"]])
      out.push(`CR ${n} ${a} on ${b} ${cr(t[a]!, t[b]!)}`);
  }
  console.log(out.join("\n"));
});
