/**
 * Normalizes and formats an Indian mobile number.
 * Input: any raw string (digits, spaces, dashes, +91 etc.)
 * Output: "+91 XXXXX XXXXX" for 10-digit numbers, partial otherwise
 */
export function formatIndianPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  return digits.slice(0, 10);
}
