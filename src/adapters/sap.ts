import { LeanAdapter } from '../types/adapter';
import { GenericAdapter } from './generic';

const base = new GenericAdapter();

/**
 * SAPAdapter — handles SAP OData v2/v4 REST API responses.
 *
 * - OData v2: root lives at payload.d.results
 * - OData v4: root lives at payload.value
 * - __metadata and __deferred are infrastructure noise → skip entirely
 * - /Date(ms)/ strings are converted to ISO-8601 via base.normalizeValue
 */
export class SAPAdapter implements LeanAdapter {
  readonly name = 'sap';
  readonly skipPatterns: RegExp[] = [
    /^__metadata/,
    /^__deferred/,
  ];

  findRoot(payload: unknown): { name: string; data: unknown[] } {
    const obj = payload as Record<string, unknown>;

    // OData v2
    const d = obj?.d as Record<string, unknown> | undefined;
    if (d && Array.isArray(d.results)) return { name: 'entity', data: d.results as unknown[] };

    // OData v4
    if (Array.isArray(obj?.value)) return { name: 'entity', data: obj.value as unknown[] };

    return base.findRoot(payload);
  }

  shouldSkipKey(keyPath: string, _value: unknown): boolean {
    return keyPath.includes('__metadata') || keyPath.includes('__deferred');
  }

  shouldDictionaryEncode(value: string): boolean {
    return base.shouldDictionaryEncode(value);
  }

  normalizeValue(value: unknown): unknown {
    return base.normalizeValue(value);
  }
}
