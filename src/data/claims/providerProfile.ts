/**
 * Provider profile — the billing entity printed on the CMS-1500 and ADA claims.
 *
 * Feeds CMS-1500 boxes 25 (federal tax ID), 31 (signature), 32 (service
 * facility), 33 (billing provider) and the ADA claim's treating-dentist block.
 *
 * ⚠ DEMO DATA ONLY. The practice, the NPIs and the tax IDs below are invented
 * teaching values. The NPIs are deliberately built to pass the NPI Luhn check
 * (80840 prefix + Luhn mod 10) so students can practise the *format* rule;
 * nothing here identifies a real provider or a real taxpayer.
 *
 * Inspiration: the billing-provider / service-facility blocks of the CMS-1500
 * (02/12) form, as they are pre-populated from the practice's credential file
 * in Epic Resolute and in most clearinghouse portals.
 */

export interface ProviderProfile {
  /** Legal name as registered with the payer (box 33 / box 32). */
  legalName: string;
  /** Street address, printed under the name. */
  address: string;
  /** City / state / ZIP line. */
  cityStateZip: string;
  /** 10-digit NPI (Luhn-valid, fictional). */
  npi: string;
  /** Federal tax ID / EIN in XX-XXXXXXX form. */
  taxId: string;
  /** Tax ID type — the CMS-1500 uses the EIN/SSN indicator. */
  taxIdType: "EIN" | "SSN";
  /** Group / billing NPI for the facility where the service happened. */
  facilityNpi: string;
  /** Signature name that stands in for the provider's wet signature. */
  signatureName: string;
  /** Referring provider used when the encounter did not name one. */
  defaultReferringProvider: string;
  defaultReferringNpi: string;
  phone: string;
}

/** Medical track — the clinic that bills the CMS-1500. */
export const MEDICAL_PROVIDER_PROFILE: ProviderProfile = {
  legalName: "Healthcare Hustlers Training Clinic, PLLC",
  address: "4120 Cedar Park Avenue, Suite 200",
  cityStateZip: "Riverbend, ST 00000",
  npi: "1336542877",
  taxId: "82-4715093",
  taxIdType: "EIN",
  facilityNpi: "1629034814",
  signatureName: "A. R. Siddiqui, MD",
  defaultReferringProvider: "Chen, Sarah, MD",
  defaultReferringNpi: "1932847563",
  phone: "(555) 0100-200",
};

/** Dental track — the practice that bills the ADA claim. */
export const DENTAL_PROVIDER_PROFILE: ProviderProfile = {
  legalName: "Healthcare Hustlers Dental",
  address: "Suite 210, Gulberg III",
  cityStateZip: "Lahore, Pakistan",
  npi: "1478523693",
  taxId: "98-7654321",
  taxIdType: "EIN",
  facilityNpi: "1478523693",
  signatureName: "F. A. Qureshi, BDS",
  defaultReferringProvider: "",
  defaultReferringNpi: "",
  phone: "+92 335 0340888",
};

/** Marker rendered on the paper so the demo values are never mistaken for real ones. */
export const DEMO_PROVIDER_NOTE =
  "Demo practice data — fictional NPI, tax ID and address for teaching use.";
