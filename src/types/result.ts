export interface LeanEncodeResult {
  /** The encoded LEAN wire-format string (or raw JSON if circuit-breaker fired) */
  encoded: string;

  /**
   * True when the output is smaller than the raw JSON input.
   * False when the circuit breaker fell back to raw JSON.
   */
  compressed: boolean;

  /** Byte length of the original JSON string */
  originalSize: number;

  /** Byte length of the encoded output */
  encodedSize: number;

  /**
   * Compression ratio: encodedSize / originalSize.
   * Values < 1 mean LEAN reduced the payload.
   */
  ratio: number;
}
