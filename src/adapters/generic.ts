import { LeanAdapter } from '../types/adapter';

// ── Safe-pass guards — values that MUST bypass dictionary encoding ────────────

/** Full URL strings — agents fire these directly as tool call arguments */
const URL_REGEX = /^https?:\/\//i;

/** ISO-8601 date prefix (date, datetime, datetime-with-tz) */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

/** OData v2 /Date(ms)/ timestamp */
const ODATA_DATE_REGEX = /^\/Date\(\d+\)\/$/;

/** Any path-like string containing a slash — likely a routing URI */
const PATH_LIKE_REGEX = /[/\\]/;

// ── HTML stripping ────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

function stripHTMLTags(val: string): string {
  return val.replace(HTML_TAG_RE, '').replace(WHITESPACE_COLLAPSE_RE, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GenericAdapter — works with any arbitrary JSON payload.
 *
 * Aligned with COTS defaults:
 *  - stripHTML: true    (HTML tags removed from all string values)
 *  - Path-like strings and ISO dates bypass dictionary
 *  - skipPatterns: []   (no keys suppressed by default)
 *
 * Root detection strategy:
 *  1. Raw array payload → wrap as "records"
 *  2. Object with array properties → pick the array with the most items
 *  3. Object with no arrays → wrap entire object as single record
 */
export class GenericAdapter implements LeanAdapter {
  readonly name = 'generic';

  /** No keys suppressed by default. Subclasses / custom adapters can override. */
  readonly skipPatterns: RegExp[] = [];

  // ── Root detection ─────────────────────────────────────────────────────────

  findRoot(payload: unknown): { name: string; data: unknown[] } {
    if (Array.isArray(payload)) {
      return { name: 'records', data: payload };
    }

    if (payload !== null && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;

      const candidates = Object.entries(obj)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => ({ name: k, data: v as unknown[] }));

      if (candidates.length === 0) {
        return { name: 'record', data: [payload] };
      }

      // Pick the largest array — most likely to be the primary data set
      candidates.sort((a, b) => b.data.length - a.data.length);
      return candidates[0];
    }

    return { name: 'records', data: [payload] };
  }

  // ── Key filtering ──────────────────────────────────────────────────────────

  shouldSkipKey(_keyPath: string, _value: unknown): boolean {
    return false; // generic adapter suppresses nothing
  }

  // ── Dictionary eligibility ─────────────────────────────────────────────────

  /**
   * Mirrors COTS dictLookup rules:
   *  - URL strings           → raw
   *  - Path-like strings     → raw
   *  - ISO-8601 date prefix  → raw
   *  - OData /Date(ms)/      → raw (will be converted by normalizeValue first)
   *  - length < dictMinLength → handled by Dictionary, but we gate on 4 here
   *  - Everything else       → eligible
   */
  shouldDictionaryEncode(value: string): boolean {
    if (!value || value.length < 4) return false;
    if (URL_REGEX.test(value)) return false;
    if (PATH_LIKE_REGEX.test(value)) return false;
    if (ISO_DATE_REGEX.test(value)) return false;
    if (ODATA_DATE_REGEX.test(value)) return false;
    return true;
  }

  // ── Value normalisation ────────────────────────────────────────────────────

  /**
   * Applied to every value before encoding (COTS stripHTML parity):
   *  1. OData /Date(ms)/ → ISO-8601 string
   *  2. Strip HTML tags + collapse whitespace from strings
   *  3. Trim surrounding whitespace
   */
  normalizeValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    // OData v2 timestamp conversion
    const odataMatch = value.match(/^\/Date\((\d+)\)\/$/);
    if (odataMatch) {
      return new Date(parseInt(odataMatch[1], 10)).toISOString();
    }

    // Strip HTML + collapse whitespace + trim
    return stripHTMLTags(value);
  }
}
