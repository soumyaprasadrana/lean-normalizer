/**
 * Dictionary — deduplicates string values and emits *N pointer tokens.
 *
 * Two frequency modes (controlled by minFrequency):
 *  - minFrequency = 1  → COTS-style: every qualifying string gets a slot
 *    (better for payloads where field values rarely repeat but are still long)
 *  - minFrequency ≥ 2  → LEAN-style: only truly repeated strings earn a slot
 *    (better when the dictionary header cost must be amortised across repeats)
 *
 * Slots are assigned in the order strings are first registered so that
 * row data can be emitted in a single pass after buildSlots().
 * The DICT block is emitted in slot-index order.
 */
export class Dictionary {
  private readonly minLength: number;
  private readonly minFrequency: number;

  /** Pass-1 frequency counter: raw string → occurrence count */
  private readonly freq = new Map<string, number>();

  /** Pass-1 insertion order: preserves first-seen order for slot assignment */
  private readonly insertOrder: string[] = [];

  /** Pass-2 final assignments: raw string → slot index */
  private readonly slots = new Map<string, number>();

  constructor(minLength = 6, minFrequency = 1) {
    this.minLength = minLength;
    this.minFrequency = minFrequency;
  }

  /** Pass 1 — register a candidate string (just count occurrences). */
  register(value: string): void {
    if (value.length < this.minLength) return;
    if (!this.freq.has(value)) {
      this.insertOrder.push(value);
      this.freq.set(value, 1);
    } else {
      this.freq.set(value, this.freq.get(value)! + 1);
    }
  }

  /**
   * Pass 2 — assign slot indices to strings that meet the frequency threshold.
   * Must be called after all register() calls and before resolve().
   *
   * When minFrequency = 1: slots assigned in first-seen order (COTS-compatible).
   * When minFrequency > 1: slots assigned in lexicographic order (deterministic
   *   across payloads with the same field values in different order).
   */
  buildSlots(): void {
    this.slots.clear();

    let eligible: string[];

    if (this.minFrequency <= 1) {
      // Preserve insertion order — matches COTS indexOf behaviour
      eligible = this.insertOrder.filter(
        (s) => (this.freq.get(s) ?? 0) >= this.minFrequency
      );
    } else {
      // Lexicographic order — fully deterministic regardless of insertion order
      eligible = [...this.freq.entries()]
        .filter(([, count]) => count >= this.minFrequency)
        .map(([str]) => str)
        .sort();
    }

    eligible.forEach((str, idx) => {
      this.slots.set(str, idx);
    });
  }

  /**
   * Returns the *N pointer token for a value if it has a dictionary slot,
   * otherwise returns the value unchanged.
   */
  resolve(value: string): string {
    const idx = this.slots.get(value);
    return idx !== undefined ? `*${idx}` : value;
  }

  /** True when a slot exists for this value. */
  has(value: string): boolean {
    return this.slots.has(value);
  }

  /**
   * Emits the ### DICT block lines, sorted by slot index.
   * Returns an empty array when the dictionary is empty.
   */
  emitBlock(): string[] {
    if (this.slots.size === 0) return [];
    const entries = [...this.slots.entries()].sort(([, a], [, b]) => a - b);
    return entries.map(([str, idx]) => `*${idx}=${str}`);
  }

  get size(): number {
    return this.slots.size;
  }
}
