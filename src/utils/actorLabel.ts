/**
 * actorLabel — who did something, in words a reader recognises.
 *
 * Ledger entries and timeline events record the signed-in student by their
 * login phone number, which is an identifier, not a name: printing it beside
 * every posting showed the student's phone number on screen (and on any
 * screenshot they share). The record keeps the id; the screen shows "You".
 */

import { getLoggedInPhone, normalizePhone } from "../store/accessStore";

export function actorLabel(by: string | null | undefined): string {
  const id = (by ?? "").trim();
  if (!id || id === "system") return "system";
  let me = "";
  try {
    me = getLoggedInPhone() ?? "";
  } catch {
    me = "";
  }
  const looksLikePhone = /^\+?[\d\s()-]{7,}$/.test(id);
  if (me && looksLikePhone && normalizePhone(id) === normalizePhone(me)) return "You";
  // Another phone (an older session, another student on this device) is still
  // a phone number — never print it.
  if (looksLikePhone) return "Student";
  return id;
}
