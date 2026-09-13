/**
 * The app's id derivation for review items and steps (LMS/lib/srs/id.ts), copied
 * here so the validator can say what an item's current hash is (ADR 0004): when
 * an author gives an existing item an `id`, listing that hash as a former id
 * keeps every learner's history for it.
 */

/** FNV-1a 32-bit hash → base36, exactly as the app computes it. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The hash the app keys a review item by when it has no `id`: of its prompt (a flashcard's front, a quiz question). */
export const itemHash = (prompt) => fnv1a(prompt);
/** The hash the app keys a lesson step by when it has no `id`: of its title. */
export const stepHash = (title) => fnv1a(title);
