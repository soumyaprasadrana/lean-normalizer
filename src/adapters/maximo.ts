import { LeanAdapter } from '../types/adapter';
import { GenericAdapter } from './generic';

const base = new GenericAdapter();

// ─── Maximo-specific skip patterns ───────────────────────────────────────────
//
// Keys in this list are stripped from every record before encoding.
// href is intentionally NOT in this list — it carries the record's self-link
// which agents use for follow-up PATCH / PUT / GET tool calls.

const MAXIMO_SKIP_PATTERNS: RegExp[] = [
  /_collectionref$/i,  // OSLC pagination / collection navigation links
  /^localref$/i,       // OSLC local cross-references (internal routing only)
  /^_rowstamp$/i,      // Optimistic-lock tokens — read noise, never needed
  /^about$/i,          // RDF resource identifier (redundant with href)
  /^rdf:about$/i,
  /^rdf:type$/i,
  /^rdf:resource$/i,
];

// ─── Namespace prefix handling ────────────────────────────────────────────────

const NAMESPACE_PREFIX_RE = /^(?:spi|rdf|oslc|dcterms|rdfs):/;

function stripSegment(seg: string): string {
  return seg.replace(NAMESPACE_PREFIX_RE, '');
}

function stripPathNamespaces(path: string): string {
  return path.split('.').map(stripSegment).join('.');
}

// ─── HTML stripping ───────────────────────────────────────────────────────────

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

function stripHTML(val: string): string {
  return val.replace(HTML_TAG_RE, '').replace(WHITESPACE_COLLAPSE_RE, ' ').trim();
}

// ─── Dictionary guards ────────────────────────────────────────────────────────
//
// URLs are emitted RAW (not dict-encoded) so agents can use them directly
// in follow-up tool calls without any reverse-lookup.

const URL_RE       = /^https?:\/\//i;
const ISO_DATE_RE  = /^\d{4}-\d{2}-\d{2}/;
const PATH_LIKE_RE = /[/\\]/;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * MaximoAdapter — full-fidelity COTS feature set applied to Maximo OSLC/REST.
 *
 *  ✔  skipPatterns : _collectionref, localref, _rowstamp, about, rdf:*
 *                    href is KEPT — it is the record self-link used by agents
 *  ✔  shouldSkipKey: only suppresses localref and about (not href)
 *  ✔  normalizePath : strips spi:/rdf:/oslc: from every key segment
 *  ✔  normalizeValue: HTML strip + OData /Date(ms)/ conversion
 *  ✔  shouldDictionaryEncode: URLs emitted inline (not in DICT) — tool-safe
 *  ✔  findRoot      : member[], rdfs:member[], working-set shape;
 *                     derives table name from OSLC OS href
 */
export class MaximoAdapter implements LeanAdapter {
  readonly name = 'maximo';
  readonly skipPatterns: RegExp[] = MAXIMO_SKIP_PATTERNS;

  // ── Root detection ─────────────────────────────────────────────────────────

  findRoot(payload: unknown): { name: string; data: unknown[] } {
    const obj = payload as Record<string, unknown>;

    // Derive table name from the OSLC Object Structure in the collection href
    // e.g. https://.../oslc/os/mxwo?... → "mxwo"
    const deriveName = (fallback: string): string => {
      const href = typeof obj?.href === 'string' ? obj.href : '';
      const match = href.match(/\/oslc\/os\/([a-z0-9_]+)/i);
      return match ? match[1].toLowerCase() : fallback;
    };

    if (Array.isArray(obj?.member))
      return { name: deriveName('member'), data: obj.member as unknown[] };

    if (Array.isArray(obj?.['rdfs:member']))
      return { name: deriveName('member'), data: obj['rdfs:member'] as unknown[] };

    // Working-set shape: top-level key whose child has a member array
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const inner = val as Record<string, unknown>;
        if (Array.isArray(inner.member)) {
          return { name: deriveName(key), data: inner.member as unknown[] };
        }
      }
    }

    return base.findRoot(payload);
  }

  // ── Key filtering ──────────────────────────────────────────────────────────

  shouldSkipKey(keyPath: string, _value: unknown): boolean {
    const rawLeaf = keyPath.split('.').pop() ?? '';
    const leaf    = stripSegment(rawLeaf);

    // Suppress only keys that carry zero agent value.
    // href is intentionally allowed through — it is the record self-link.
    return leaf === 'localref' || leaf === 'about';
  }

  // ── Key-path normalisation ─────────────────────────────────────────────────

  normalizePath(keyPath: string): string {
    return stripPathNamespaces(keyPath);
  }

  // ── Dictionary eligibility ─────────────────────────────────────────────────

  shouldDictionaryEncode(value: string): boolean {
    if (!value) return false;
    // URLs must stay raw so agents can fire them directly as tool-call arguments
    if (URL_RE.test(value)) return false;
    // Other path-like strings (e.g. file paths) also bypass the dictionary
    if (PATH_LIKE_RE.test(value)) return false;
    // ISO dates must stay raw so agents can parse / compare them directly
    if (ISO_DATE_RE.test(value)) return false;
    if (value.length < 4) return false;
    return true;
  }

  // ── Value normalisation ────────────────────────────────────────────────────

  normalizeValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    let v = value;
    // Strip namespace prefix that appears on some enumeration values
    v = v.replace(NAMESPACE_PREFIX_RE, '');
    // Strip HTML tags and collapse whitespace (COTS stripHTML parity)
    v = stripHTML(v);
    // OData /Date(ms)/ → ISO-8601 (delegates to base)
    const converted = base.normalizeValue(v);
    return converted;
  }
}
