import { PASTEL_TONES, type CategoryTone } from "../../chores/logic/categoryStyle";

/** FNV-1a, 32 bits, over the UTF-8 bytes of the text. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The pastel an initials Avatar wears: a hash of the user id, so the same person always gets the same colours. */
export function avatarTone(userId: string): CategoryTone {
  return PASTEL_TONES[fnv1a(userId) % PASTEL_TONES.length]!;
}
