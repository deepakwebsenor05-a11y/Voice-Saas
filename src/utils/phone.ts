import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Format a raw phone string to E.164 using libphonenumber-js.
 * @param raw raw phone input
 * @param defaultRegion optional ISO 2-letter region (e.g. 'US', 'IN')
 * @returns E.164 string like +12025550123 or null if cannot parse/validate
 */
export function formatToE164(raw: string | undefined | null, defaultRegion?: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  try {
    // If a defaultRegion is provided, try that first
    if (defaultRegion) {
      const parsed = parsePhoneNumberFromString(s, defaultRegion as any);
      if (parsed && parsed.isValid()) return parsed.format('E.164');
    }

    // Heuristic: if no region provided, detect common Indian 10-digit mobile numbers
    const digits = s.replace(/\D/g, '');
    let heuristicRegion: string | undefined;
    // Indian mobile numbers are typically 10 digits and start with 6-9
    if (!defaultRegion && /^([6-9]\d{9})$/.test(digits)) {
      heuristicRegion = 'IN';
    }

    if (heuristicRegion) {
      const parsed = parsePhoneNumberFromString(s, heuristicRegion as any);
      if (parsed && parsed.isValid()) return parsed.format('E.164');
    }

    // Final attempt without forcing a region (may parse if number already has +country)
    const parsedFallback = parsePhoneNumberFromString(s);
    if (!parsedFallback) return null;
    if (!parsedFallback.isValid()) return null;
    return parsedFallback.format('E.164');
  } catch (err) {
    return null;
  }
}

export default formatToE164;
