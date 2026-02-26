import { LeanAdapter } from './adapter';

export interface LeanConfig {
  /**
   * Adapter that drives all vendor-specific decisions.
   * Defaults to GenericAdapter when not provided.
   */
  adapter?: LeanAdapter;

  /**
   * Minimum string length required before a value is considered for
   * dictionary encoding.  Shorter strings are emitted inline.
   * @default 6
   */
  dictMinLength?: number;

  /**
   * Minimum number of times a string must appear before it earns a
   * dictionary slot.  Set to 1 to encode every qualifying string once
   * (COTS-style), or 2+ to only encode repeated strings.
   * @default 1
   */
  dictMinFrequency?: number;

  /**
   * When true, the encoder strips basic HTML tags from string values
   * via the adapter's normalizeValue hook.
   * @default true
   */
  stripHTML?: boolean;

  /**
   * When true, returns raw JSON instead of throwing on any internal error.
   * @default true
   */
  fallbackOnFail?: boolean;

  /**
   * When true, completely omit fields whose value is an empty string.
   * Mirrors COTS behaviour where empty strings are treated as noise.
   * @default true
   */
  skipEmptyStrings?: boolean;
}
