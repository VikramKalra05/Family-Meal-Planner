/** Age in whole years from an ISO date of birth. */
export function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - Date.parse(dob)) / (365.25 * 24 * 3600 * 1000));
}
