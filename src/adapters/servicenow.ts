import { LeanAdapter } from '../types/adapter';
import { GenericAdapter } from './generic';

const base = new GenericAdapter();

/**
 * ServiceNowAdapter — handles ServiceNow REST Table API responses.
 *
 * - Root array lives at payload.result
 * - Reference fields are objects with { link, value } — we keep "value", drop "link"
 * - sys_class_name, sys_domain, sys_domain_path are metadata noise → skip
 */
export class ServiceNowAdapter implements LeanAdapter {
  readonly name = 'servicenow';
  readonly skipPatterns: RegExp[] = [];

  findRoot(payload: unknown): { name: string; data: unknown[] } {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj?.result)) return { name: 'incident', data: obj.result as unknown[] };
    return base.findRoot(payload);
  }

  shouldSkipKey(keyPath: string, value: unknown): boolean {
    const leaf = keyPath.split('.').pop() ?? '';

    // Drop the "link" half of ServiceNow reference objects
    if (leaf === 'link' && typeof value === 'string' && value.startsWith('http')) return true;

    const skipLeafs = new Set(['sys_class_name', 'sys_domain', 'sys_domain_path']);
    return skipLeafs.has(leaf);
  }

  shouldDictionaryEncode(value: string): boolean {
    return base.shouldDictionaryEncode(value);
  }

  normalizeValue(value: unknown): unknown {
    return base.normalizeValue(value);
  }
}
