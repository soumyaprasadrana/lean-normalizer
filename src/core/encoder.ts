import { LeanConfig } from '../types/config';
import { LeanEncodeResult } from '../types/result';
import { GenericAdapter } from '../adapters/generic';
import { Dictionary } from './dictionary';
import { SchemaRegistry } from './schema';
import { TableBuilder } from './table-builder';
import { CircuitBreaker } from './circuit-breaker';

const LEAN_HEADER = '### LEAN FORMAT v1';

/**
 * LeanEncoder — the central orchestrator.
 *
 * Encoding pipeline (mirrors COTS v2.1 flow, generalised for any adapter):
 *
 *   1. adapter.findRoot       → locate primary record array in payload
 *   2. TableBuilder.buildRoot → Pass 1: flatten records, sentinel-wrap dict candidates
 *   3. dict.buildSlots        → Pass 1.5: assign *N slots
 *   4. builder.resolveDicts   → Pass 2: replace sentinels with *N or inline values
 *   5. Assemble wire format   → DICT + SCHEMA + DATA blocks
 *   6. CircuitBreaker         → fall back to raw JSON when not beneficial
 *
 * Config defaults are aligned with COTS behaviour:
 *   - dictMinFrequency = 1  (encode any qualifying string, not just repeated ones)
 *   - stripHTML = true      (clean HTML noise from string values)
 *   - skipEmptyStrings = true (omit empty-string fields entirely)
 */
export class LeanEncoder {
  private readonly config: Required<LeanConfig>;
  private readonly cb = new CircuitBreaker();

  constructor(options: LeanConfig = {}) {
    const adapter = options.adapter ?? new GenericAdapter();
    this.config = {
      adapter,
      dictMinLength: options.dictMinLength ?? 6,
      dictMinFrequency: options.dictMinFrequency ?? 1,
      stripHTML: options.stripHTML !== false,       // default true (COTS parity)
      fallbackOnFail: options.fallbackOnFail !== false,
      skipEmptyStrings: options.skipEmptyStrings !== false, // default true
    } as Required<LeanConfig>;
  }

  // ─── public API ─────────────────────────────────────────────────────────────

  encode(payload: unknown): LeanEncodeResult {
    const rawJson = JSON.stringify(payload);
    const originalSize = Buffer.byteLength(rawJson, 'utf8');

    try {
      const encoded = this._encode(payload);
      const encodedSize = Buffer.byteLength(encoded, 'utf8');

      if (this.cb.shouldFallback(encodedSize, originalSize)) {
        return this._fallbackResult(rawJson, originalSize);
      }

      return {
        encoded,
        compressed: true,
        originalSize,
        encodedSize,
        ratio: parseFloat(this.cb.ratio(encodedSize, originalSize).toFixed(3)),
      };
    } catch (err) {
      if (this.config.fallbackOnFail) {
        return this._fallbackResult(rawJson, originalSize);
      }
      throw err;
    }
  }

  encodeToString(payload: unknown): string {
    return this.encode(payload).encoded;
  }

  // ─── private pipeline ───────────────────────────────────────────────────────

  private _encode(payload: unknown): string {
    const { adapter, dictMinLength, dictMinFrequency, skipEmptyStrings } = this.config;

    const { name: tableName, data: records } = adapter.findRoot(payload);

    if (records.length === 0) {
      throw new Error('Empty root array — nothing to encode.');
    }

    const dict    = new Dictionary(dictMinLength, dictMinFrequency);
    const schema  = new SchemaRegistry();
    const builder = new TableBuilder(schema, dict, adapter, skipEmptyStrings);

    // Pass 1
    builder.buildRoot(tableName, records);

    // Pass 1.5
    dict.buildSlots();

    // Pass 2
    builder.resolveDictionary();

    // ── Assemble output ──────────────────────────────────────────────────────
    const lines: string[] = [LEAN_HEADER, ''];

    // DICT block
    const dictLines = dict.emitBlock();
    if (dictLines.length > 0) {
      lines.push('### DICT');
      lines.push(...dictLines);
      lines.push('');
    }

    // SCHEMA block
    const schemaLines = schema.emitBlock();
    if (schemaLines.length > 0) {
      lines.push('### SCHEMA');
      lines.push(...schemaLines);
      lines.push('');
    }

    // DATA blocks — root table first, child tables after
    const tables = builder.getTables();
    for (const [tname, rows] of tables.entries()) {
      if (rows.length === 0) continue;
      lines.push(`### DATA: ${tname}`);
      for (const row of rows) {
        const parts: string[] = [];
        if (row._p === undefined) {
          parts.push(`_id:${row._id}`);
        } else {
          // Child rows: emit parent reference, use _id as local index
          parts.push(`_id:${row._id}`);
          parts.push(`_p:${row._p}`);
        }
        for (const [k, v] of row.fields.entries()) {
          parts.push(`${k}:${v}`);
        }
        lines.push(parts.join(' '));
      }
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  }

  private _fallbackResult(rawJson: string, originalSize: number): LeanEncodeResult {
    return {
      encoded: rawJson,
      compressed: false,
      originalSize,
      encodedSize: originalSize,
      ratio: 1,
    };
  }
}
