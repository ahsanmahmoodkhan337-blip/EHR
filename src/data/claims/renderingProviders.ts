/**
 * Rendering providers — who signed the note becomes who signs the claim.
 *
 * Inspired by: Epic's provider dictionary and the CMS-1500's rendering-provider
 * block, where box 24J's NPI and box 31's signature come from the provider the
 * visit was booked with — not from whoever happens to be logged in, and not from
 * one constant printed on every claim.
 *
 * Phase 1 of the owner's work order (`specs/phase1-data-integrity.md` item 4):
 * "the provider chosen on the appointment is the rendering provider: Box 31 and
 * Box 24J … booking 'Dr. Sarah Lee' produces a claim signed by Dr. Sarah Lee."
 * Until this module existed the claim printed `MEDICAL_PROVIDER_PROFILE`, so
 * every claim in the practice was signed by the same clinician.
 *
 * ⚠ DEMO DATA ONLY. Every NPI here is invented for teaching. They are built to
 * pass the NPI Luhn check (80840 prefix + Luhn mod 10) so a student can practise
 * the format rule; none of them identifies a real provider.
 *
 * A provider who is not in the directory (the appointment form accepts a typed
 * name) still gets a fictional NPI, derived from that provider's own name. It is
 * stable — the same name gives the same NPI on every reload — and different
 * between providers, so two providers never share one. Nothing is invented about
 * the *practice*: the address, tax ID, facility NPI and tax-ID type stay the
 * billing profile's own.
 */

import { MEDICAL_PROVIDER_PROFILE, type ProviderProfile } from "./providerProfile";

export interface RenderingProvider {
  /** The name as the appointment booked it, e.g. "Dr. Sarah Lee". */
  name: string;
  /** Box 24J / box 76 — a fictional, Luhn-valid 10-digit NPI. */
  npi: string;
}

/**
 * The providers this practice books. The NPIs are the values `npiForName`
 * derives for these names, written out so a directory entry never moves when the
 * derivation changes.
 */
export const RENDERING_PROVIDERS: readonly RenderingProvider[] = [
  { name: "Dr. Sarah Lee", npi: "3240802181" },
  { name: "Dr. Michael Ross", npi: "1576101517" },
  { name: "Dr. Priya Nair", npi: "0032297828" },
];

/** FNV-1a — the same stable hash `domain/patientCard.ts` uses. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Luhn check over the 14 digits `80840` + a 9-digit base. */
function luhnCheckDigit(payload: string): number {
  let sum = 0;
  let double = true;
  for (let i = payload.length - 1; i >= 0; i -= 1) {
    let digit = payload.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** True when a 10-digit NPI passes the Luhn check. Used by the tests. */
export function isLuhnValidNpi(npi: string): boolean {
  const value = String(npi ?? "").trim();
  if (!/^\d{10}$/.test(value)) return false;
  const digits = `80840${value}`;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** The fictional NPI for a provider name — directory first, else derived. */
export function npiForName(name: string): string {
  const value = String(name ?? "").trim();
  if (!value) return "";
  const known = RENDERING_PROVIDERS.find((provider) => provider.name === value);
  if (known) return known.npi;
  const base = String(hash32(value) % 1_000_000_000).padStart(9, "0");
  return `${base}${luhnCheckDigit(`80840${base}`)}`;
}

/** The provider a name names, or null when no name was captured. */
export function renderingProviderFor(name: string | null | undefined): RenderingProvider | null {
  const value = String(name ?? "").trim();
  if (!value) return null;
  return { name: value, npi: npiForName(value) };
}

/**
 * The billing profile for the provider who signed the visit.
 *
 * Boxes 31 (signature) and 24J (rendering NPI) follow the provider; boxes 32/33
 * and 25 stay the practice's own, because the facility that renders the service
 * is the same clinic whichever clinician saw the patient. With no provider named
 * on the appointment the practice profile stands, unchanged.
 */
export function providerProfileFor(
  name: string | null | undefined,
  base: ProviderProfile = MEDICAL_PROVIDER_PROFILE,
): ProviderProfile {
  const provider = renderingProviderFor(name);
  if (!provider) return base;
  return { ...base, signatureName: provider.name, npi: provider.npi };
}
