/**
 * removeStagePinState — one-time cleanup of the retired stage-PIN storage
 *
 * Stage PINs no longer exist (owner brief `specs/task-0b-remove-pin.md`):
 * selecting a role or a pipeline stage opens that workspace directly. The
 * deleted `pinStore` left two keys behind in every browser that ever ran the
 * gated build:
 *   - `hh_stage_pins`      the PIN per stage (shipped defaults 1111–5555)
 *   - `hh_unlocked_stages` which stages the student had already unlocked
 *
 * Both are deleted on load so nobody is left on a "Stage Locked" screen, and
 * nothing else is touched. The per-user progress blob (`hh_userdata_<phone>` —
 * appointments, patients, encounter notes, codes, claims, typed claim boxes,
 * PA records, AR calls), the access/enrolment keys and the account-security
 * slice all stay exactly as saved. This function never reads or rewrites a
 * value; it only removes the two retired keys.
 *
 * Inspiration: Epic Hyperspace client-cache versioning — retire the old cache
 * keys, keep the record.
 */

/** The two retired localStorage keys, named once. */
export const RETIRED_STAGE_PIN_KEYS = ["hh_stage_pins", "hh_unlocked_stages"] as const;

/**
 * Delete the retired stage-PIN keys, and only those keys. Returns the keys it
 * actually removed so the migration's exact effect is observable. Safe to call
 * on every load: with nothing stored it removes nothing and returns `[]`.
 */
export function removeStagePinState(
  storage: Storage | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): string[] {
  if (!storage) return [];
  const removed: string[] = [];
  for (const key of RETIRED_STAGE_PIN_KEYS) {
    try {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        removed.push(key);
      }
    } catch {
      // Private mode / quota errors must never stop the app from opening.
    }
  }
  return removed;
}
