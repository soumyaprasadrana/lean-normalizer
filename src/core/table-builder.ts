import { LeanAdapter } from '../types/adapter';
import { Dictionary } from './dictionary';
import { SchemaRegistry } from './schema';

export interface FlatRow {
  /** Auto-assigned row id within its table */
  _id: number;
  /** Parent row id — set for all child-table rows */
  _p?: number;
  /** Short-key → encoded-value pairs (insertion-ordered) */
  fields: Map<string, string>;
}

/**
 * TableBuilder — flattens arbitrarily nested JSON objects into a set of
 * relational tables while preserving parent-child relationships.
 *
 * Behaviour inherited from COTS:
 *  - Empty string values are skipped when skipEmptyStrings = true
 *  - Regex skipPatterns on the adapter are evaluated alongside shouldSkipKey
 *  - Nested plain objects are flattened inline (dotted key path)
 *  - Nested object-arrays become child tables linked via _p
 *
 * Key-path normalisation:
 *  - adapter.normalizePath() is called on every full path BEFORE it is
 *    registered in the SchemaRegistry.  This is how Maximo's "spi:wonum"
 *    becomes "wonum" in the SCHEMA block.
 *
 * Two-pass encoding:
 *  Pass 1   – flattenObject → encodeScalar → sentinel-wrap dict candidates
 *  Pass 1.5 – dict.buildSlots()  (called by Encoder)
 *  Pass 2   – resolveDictionary  → replace sentinels with *N or inline value
 */
export class TableBuilder {
  private readonly tables = new Map<string, FlatRow[]>();
  private readonly idCounters = new Map<string, number>();

  constructor(
    private readonly schema: SchemaRegistry,
    private readonly dict: Dictionary,
    private readonly adapter: LeanAdapter,
    private readonly skipEmptyStrings: boolean = true,
  ) {}

  /** Processes all records under a root table name (Pass 1 entry point). */
  buildRoot(tableName: string, records: unknown[]): void {
    records.forEach((record) => {
      this.flattenObject(tableName, record, undefined, '');
    });
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  /**
   * Normalises a full dot-notation key path via the adapter's optional
   * normalizePath hook before registering it in the SchemaRegistry.
   * Falls back to identity when the adapter does not implement the hook.
   *
   * Example (Maximo):
   *   "spi:wplabor.spi:laborcode"  →  "wplabor.laborcode"
   */
  private normPath(keyPath: string): string {
    return this.adapter.normalizePath ? this.adapter.normalizePath(keyPath) : keyPath;
  }

  private nextId(tableName: string): number {
    const id = this.idCounters.get(tableName) ?? 0;
    this.idCounters.set(tableName, id + 1);
    return id;
  }

  /**
   * Returns true when a key path should be excluded from output.
   * Combines adapter.shouldSkipKey (exact/contextual logic) with
   * adapter.skipPatterns (regex-based bulk suppression from COTS).
   */
  private shouldSkip(keyPath: string, value: unknown): boolean {
    if (this.adapter.shouldSkipKey(keyPath, value)) return true;

    const patterns = this.adapter.skipPatterns;
    if (patterns && patterns.length > 0) {
      const leaf = keyPath.split('.').pop() ?? keyPath;
      return patterns.some((p) => p.test(leaf) || p.test(keyPath));
    }

    return false;
  }

  private flattenObject(
    tableName: string,
    obj: unknown,
    parentId: number | undefined,
    pathPrefix: string,
  ): number {
    const rowId = this.nextId(tableName);
    const fields = new Map<string, string>();
    const row: FlatRow = { _id: rowId, fields };
    if (parentId !== undefined) row._p = parentId;

    if (!this.tables.has(tableName)) this.tables.set(tableName, []);
    this.tables.get(tableName)!.push(row);

    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      const entries = Object.entries(obj as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );

      for (const [rawKey, rawValue] of entries) {
        const fullPath = pathPrefix ? `${pathPrefix}.${rawKey}` : rawKey;

        if (this.shouldSkip(fullPath, rawValue)) continue;

        const value = this.adapter.normalizeValue(rawValue);

        if (Array.isArray(value)) {
          if (value.length === 0) continue;

          if (typeof value[0] === 'object' && value[0] !== null) {
            const childTable = `${tableName}.${rawKey}`;
            value.forEach((item) => {
              this.flattenObject(childTable, item, rowId, rawKey);
            });
          } else {
            const joined = value.map(String).join('|');
            const schemaKey = this.schema.key(this.normPath(fullPath));
            row.fields.set(schemaKey, this.encodeScalar(joined, fullPath));
          }
        } else if (value !== null && typeof value === 'object') {
          this.flattenNestedObject(tableName, value as Record<string, unknown>, row, fullPath);
        } else {
          if (this.skipEmptyStrings && value === '') continue;
          const schemaKey = this.schema.key(this.normPath(fullPath));
          row.fields.set(schemaKey, this.encodeScalar(value, fullPath));
        }
      }
    } else if (obj !== null && obj !== undefined) {
      const schemaKey = this.schema.key('_value');
      row.fields.set(schemaKey, this.encodeScalar(obj, '_value'));
    }

    return rowId;
  }

  private flattenNestedObject(
    tableName: string,
    obj: Record<string, unknown>,
    row: FlatRow,
    pathPrefix: string,
  ): void {
    const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));

    for (const [rawKey, rawValue] of entries) {
      const fullPath = `${pathPrefix}.${rawKey}`;

      if (this.shouldSkip(fullPath, rawValue)) continue;

      const value = this.adapter.normalizeValue(rawValue);

      if (Array.isArray(value)) {
        if (value.length === 0) continue;

        if (typeof value[0] === 'object' && value[0] !== null) {
          const childTable = `${tableName}.${rawKey}`;
          value.forEach((item) => {
            this.flattenObject(childTable, item, row._id, rawKey);
          });
        } else {
          const schemaKey = this.schema.key(this.normPath(fullPath));
          row.fields.set(schemaKey, this.encodeScalar(value.map(String).join('|'), fullPath));
        }
      } else if (value !== null && typeof value === 'object') {
        this.flattenNestedObject(tableName, value as Record<string, unknown>, row, fullPath);
      } else {
        if (this.skipEmptyStrings && value === '') continue;
        const schemaKey = this.schema.key(this.normPath(fullPath));
        row.fields.set(schemaKey, this.encodeScalar(value, fullPath));
      }
    }
  }

  private encodeScalar(value: unknown, _path: string): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);

    const str = String(value);

    if (this.adapter.shouldDictionaryEncode(str)) {
      this.dict.register(str);
      return `\x00${str}\x00`;
    }
    return this.escapeValue(str);
  }

  resolveDictionary(): void {
    for (const rows of this.tables.values()) {
      for (const row of rows) {
        for (const [key, val] of row.fields.entries()) {
          if (val.startsWith('\x00') && val.endsWith('\x00')) {
            const raw = val.slice(1, -1);
            row.fields.set(key, this.escapeValue(this.dict.resolve(raw)));
          }
        }
      }
    }
  }

  private escapeValue(str: string): string {
    if (/[\s]/.test(str) || str.includes(':') || str.startsWith('*')) {
      return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  getTables(): Map<string, FlatRow[]> {
    return this.tables;
  }
}
