// ─── Public API ─────────────────────────────────────────────────────────────
export { LeanEncoder } from './core/encoder';

// ─── Types ───────────────────────────────────────────────────────────────────
export type { LeanAdapter } from './types/adapter';
export type { LeanConfig } from './types/config';
export type { LeanEncodeResult } from './types/result';

// ─── Built-in Adapters ───────────────────────────────────────────────────────
export { GenericAdapter } from './adapters/generic';
export { MaximoAdapter } from './adapters/maximo';
export { ServiceNowAdapter } from './adapters/servicenow';
export { SAPAdapter } from './adapters/sap';
