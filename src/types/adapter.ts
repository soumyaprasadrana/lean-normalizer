/**
 * LeanAdapter — the plugin contract for vendor-specific API normalization.
 * All field-level, root-detection, and encoding decisions are injected here.
 */
export interface LeanAdapter {
  /** Human-readable adapter name, e.g. "maximo", "servicenow", "generic" */
  name: string;

  /**
   * Locates the primary record array within the raw API payload.
   * Returns the array's logical name and items.
   */
  findRoot(payload: unknown): { name: string; data: unknown[] };

  /**
   * Returns true if this key/value pair should be entirely omitted from output.
   * @param keyPath  Dot-separated full path, e.g. "member.0._collectionref"
   * @param value    The raw value at that path
   */
  shouldSkipKey(keyPath: string, value: unknown): boolean;

  /**
   * Returns true if this string value is a candidate for dictionary encoding.
   * Implementations MUST return false for URLs, paths, and ISO-8601 dates
   * so that agents can fire follow-up tool calls without any reverse-lookup.
   */
  shouldDictionaryEncode(value: string): boolean;

  /**
   * Value transformation hook — runs BEFORE dictionary encoding.
   * Use for: HTML stripping, namespace prefix removal, OData date parsing,
   * whitespace normalisation, etc.
   * Return the value unchanged when no transformation is needed.
   */
  normalizeValue(value: unknown): unknown;

  /**
   * Key-path transformation hook — called on every full dot-notation path
   * BEFORE it is registered in the SchemaRegistry.
   *
   * Use to strip vendor namespace prefixes from field names so SCHEMA keys
   * are clean and readable.  For example, Maximo's "spi:wonum" becomes
   * "wonum", and "spi:wplabor.spi:laborcode" becomes "wplabor.laborcode".
   *
   * Return the path unchanged when no transformation is needed.
   * Defaults to identity when not implemented by the adapter.
   */
  normalizePath?(keyPath: string): string;

  /**
   * Optional list of regex patterns for key paths that must be skipped
   * entirely.  Checked in addition to shouldSkipKey.
   * Adapters that need pattern-based skipping (e.g. Maximo's _rowstamp,
   * _collectionref) should populate this.
   */
  skipPatterns?: RegExp[];
}
