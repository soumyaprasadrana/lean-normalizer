/**
 * SchemaRegistry — maps full dot-notation JSON paths to short base-36 keys.
 *
 * Keys are assigned in the order paths are first encountered, making the
 * output deterministic for a given input shape.
 */
export class SchemaRegistry {
  private readonly pathToKey = new Map<string, string>();
  private counter = 0;

  /**
   * Returns the short key for a path, creating one if this path is new.
   */
  key(path: string): string {
    let k = this.pathToKey.get(path);
    if (k === undefined) {
      k = this.counter.toString(36); // base-36: 0..9a..z
      this.pathToKey.set(path, k);
      this.counter++;
    }
    return k;
  }

  /**
   * Emits the ### SCHEMA block lines.
   * Entries are sorted by their short key (numeric base-36 order).
   */
  emitBlock(): string[] {
    const entries = [...this.pathToKey.entries()].sort(([, a], [, b]) =>
      this.compareBase36(a, b)
    );
    return entries.map(([path, k]) => `${k}=${path}`);
  }

  private compareBase36(a: string, b: string): number {
    // Numeric comparison on base-36 values
    return parseInt(a, 36) - parseInt(b, 36);
  }

  get size(): number {
    return this.pathToKey.size;
  }
}
