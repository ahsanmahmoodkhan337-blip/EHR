/**
 * Per-student storage scope.
 *
 * Owner decision 2026-11-20 (`specs/scores-per-student.md`): scores, streak,
 * challenges and the command-palette store belong to the student, not the
 * device. A shared classroom machine is the normal case here, so every one of
 * those stores is keyed with the signed-in phone.
 *
 * The phone is the string the student typed at login — `hh_logged_in_phone`,
 * written by `setLoggedInPhone()` in `store/accessStore.ts`. It is read here
 * verbatim and is **never normalised** (a separate, unapproved decision), so a
 * `+92` student and a `92` student are two different keys, exactly as they are
 * two different accounts in the access store.
 *
 * This module reads the key straight out of localStorage instead of importing
 * `accessStore`, so `utils/scoring.ts` stays importable in a plain test without
 * pulling in Supabase and the whole chart store.
 *
 * Inspiration: DrChrono's per-user preferences — everything a user configures
 * follows the user, never the browser.
 */

/** The access store's session key. Kept in step with `accessStore.ts`. */
const LOGGED_IN_PHONE_KEY = "hh_logged_in_phone";

function localStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * The signed-in phone, exactly as typed. `null` when nobody is signed in — and
 * a `null` phone means "write nothing, read nothing", never "use a shared key".
 */
export function getScopePhone(): string | null {
  const storage = localStore();
  if (!storage) return null;
  try {
    const phone = storage.getItem(LOGGED_IN_PHONE_KEY);
    return phone && phone.length > 0 ? phone : null;
  } catch {
    return null;
  }
}

/** `base_<phone>`, or `null` when no student is signed in. */
export function scopedKey(base: string, phone: string | null = getScopePhone()): string | null {
  return phone ? `${base}_${phone}` : null;
}

/** Read this student's value for `base`. Signed out reads nothing. */
export function readStudentItem(base: string, phone?: string | null): string | null {
  const key = scopedKey(base, phone);
  const storage = localStore();
  if (!key || !storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Write this student's value for `base`. Signed out writes nothing. */
export function writeStudentItem(base: string, value: string, phone?: string | null): void {
  const key = scopedKey(base, phone);
  const storage = localStore();
  if (!key || !storage) return;
  try {
    storage.setItem(key, value);
  } catch (e) {
    console.warn("studentScope: could not write", base, e);
  }
}

/** Remove this student's value for `base` — only ever this student's key. */
export function removeStudentItem(base: string, phone?: string | null): void {
  const key = scopedKey(base, phone);
  const storage = localStore();
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch (e) {
    console.warn("studentScope: could not remove", base, e);
  }
}

/**
 * Read a pre-phone-keyed value (`hh_scores` with no suffix) — the old
 * device-wide store. Only a migration reads this; normal reads go through
 * `readStudentItem`. Never deleted: the old value is the only copy a second
 * student on the same machine has.
 */
export function readLegacyItem(base: string): string | null {
  const storage = localStore();
  if (!storage) return null;
  try {
    return storage.getItem(base);
  } catch {
    return null;
  }
}
