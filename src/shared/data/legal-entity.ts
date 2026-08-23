/**
 * Who Seyon legally is, in one place.
 *
 * The privacy policy and the terms both shipped bracketed editorial notes to
 * real customers — literally `[Name]`, `[Designation]` and
 * `*[Required under the DPDP Act, 2023 ...]*` rendered inside the live page.
 * Two problems with that: it reads as unfinished to anyone who scrolls, and
 * duplicating the block across two files meant filling one in would leave the
 * other stale.
 *
 * The DPDP Act, 2023 (s.13) requires a published, contactable grievance route,
 * and the Consumer Protection (E-Commerce) Rules, 2020 require a named
 * grievance officer with contact details and a response window. Neither is
 * something code can invent — the name has to be a real person who will
 * actually answer. What code can do is make the details come from exactly one
 * place, and make the page say something honest when that place is empty
 * rather than exposing the fact that nobody has been appointed.
 *
 * To go live: set the four NEXT_PUBLIC_GRIEVANCE_* values below. Until they
 * are set, `checkEnvironment` warns at boot and the pages fall back to the
 * support inbox.
 */

export interface GrievanceOfficer {
  name: string;
  designation: string;
  email: string;
  address: string | null;
}

export const LEGAL_CONTACTS = {
  privacy: 'privacy@seyon.in',
  support: 'support@seyon.in',
  legal: 'legal@seyon.in',
} as const;

/** The statutory window to acknowledge a complaint under the 2020 e-commerce rules. */
export const GRIEVANCE_ACKNOWLEDGEMENT_HOURS = 48;
/** The statutory window to resolve one. */
export const GRIEVANCE_RESOLUTION_DAYS = 30;

const value = (raw: string | undefined): string | null => {
  const trimmed = (raw ?? '').trim();
  // Reject the placeholder shapes as hard as an empty string; a policy page
  // saying "[Name]" is worse than one saying the appointment is pending.
  if (!trimmed || /^\[.*\]$/.test(trimmed) || /^(tbd|todo|xxx)$/i.test(trimmed)) return null;
  return trimmed;
};

/**
 * Written out as literal member expressions on purpose: Next only inlines
 * `process.env.NEXT_PUBLIC_*` into the bundle when it can see the property
 * name statically. Indexing a `process.env` alias would compile to `undefined`
 * in any client component that imported this.
 */
const BUILD_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_GRIEVANCE_NAME: process.env.NEXT_PUBLIC_GRIEVANCE_NAME,
  NEXT_PUBLIC_GRIEVANCE_DESIGNATION: process.env.NEXT_PUBLIC_GRIEVANCE_DESIGNATION,
  NEXT_PUBLIC_GRIEVANCE_EMAIL: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL,
  NEXT_PUBLIC_GRIEVANCE_ADDRESS: process.env.NEXT_PUBLIC_GRIEVANCE_ADDRESS,
};

/**
 * The appointed officer, or null when nobody has been appointed yet.
 *
 * Read from NEXT_PUBLIC_* because both legal pages are statically rendered and
 * the details are public by law — there is nothing here to keep secret.
 */
export function grievanceOfficer(
  env: Record<string, string | undefined> = BUILD_ENV
): GrievanceOfficer | null {
  const name = value(env.NEXT_PUBLIC_GRIEVANCE_NAME);
  const designation = value(env.NEXT_PUBLIC_GRIEVANCE_DESIGNATION);
  const email = value(env.NEXT_PUBLIC_GRIEVANCE_EMAIL);

  // A name without a way to reach it is not a grievance route. All three are
  // required together or the officer counts as unappointed.
  if (!name || !designation || !email) return null;

  return {
    name,
    designation,
    email,
    address: value(env.NEXT_PUBLIC_GRIEVANCE_ADDRESS),
  };
}

export function isGrievanceOfficerAppointed(
  env: Record<string, string | undefined> = BUILD_ENV
): boolean {
  return grievanceOfficer(env) !== null;
}
