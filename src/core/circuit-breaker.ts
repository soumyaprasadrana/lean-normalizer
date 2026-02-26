/**
 * CircuitBreaker — compares encoded size to raw JSON size and decides
 * whether the LEAN wire format is actually beneficial.
 *
 * When normalized output >= raw JSON, return the raw JSON directly.
 * This ensures we never make an LLM context window worse.
 */
export class CircuitBreaker {
  shouldFallback(encodedSize: number, originalSize: number): boolean {
    return encodedSize >= originalSize;
  }

  ratio(encodedSize: number, originalSize: number): number {
    if (originalSize === 0) return 1;
    return encodedSize / originalSize;
  }
}
