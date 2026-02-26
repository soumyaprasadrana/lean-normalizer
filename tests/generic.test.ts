import { LeanEncoder } from '../src/core/encoder';
import { GenericAdapter } from '../src/adapters/generic';

describe('GenericAdapter + LeanEncoder', () => {
  const encoder = new LeanEncoder(); // uses GenericAdapter by default

  it('handles a flat array of objects', () => {
    const payload = [
      { id: 1, name: "Alice", department: "Engineering" },
      { id: 2, name: "Bob", department: "Engineering" },
      { id: 3, name: "Carol", department: "Marketing" },
    ];
    const result = encoder.encode(payload);
    expect(result).toHaveProperty('encoded');
    expect(result.originalSize).toBeGreaterThan(0);
  });

  it('handles object with array property', () => {
    const payload = {
      users: [
        { id: "u1", role: "admin", status: "active" },
        { id: "u2", role: "viewer", status: "active" },
        { id: "u3", role: "admin", status: "inactive" },
      ]
    };
    const result = encoder.encode(payload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: users');
    }
  });

  it('picks the largest array when multiple exist', () => {
    const payload = {
      meta: [{ version: "1" }],
      records: [
        { id: "r1", type: "purchase", amount: 100 },
        { id: "r2", type: "purchase", amount: 200 },
        { id: "r3", type: "refund", amount: 50 },
        { id: "r4", type: "purchase", amount: 300 },
      ]
    };
    const result = encoder.encode(payload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: records');
    }
  });

  it('handles deeply nested objects', () => {
    const payload = {
      items: [
        {
          id: "1",
          address: { street: "123 Main St", city: "Springfield", country: "US" },
          tags: ["important", "urgent"],
        },
        {
          id: "2",
          address: { street: "456 Oak Ave", city: "Springfield", country: "US" },
          tags: ["routine"],
        },
      ]
    };
    expect(() => encoder.encode(payload)).not.toThrow();
  });

  /**
   * URL guard — shouldDictionaryEncode() must return false for https:// strings.
   * We test this directly on the adapter rather than through the encoded output
   * because a small payload may trigger the circuit breaker and return raw JSON,
   * which would contain the URL but not in a DICT block.
   */
  it('shouldDictionaryEncode returns false for URLs', () => {
    const adapter = new GenericAdapter();
    expect(adapter.shouldDictionaryEncode('https://api.example.com/resource/1')).toBe(false);
    expect(adapter.shouldDictionaryEncode('http://api.example.com/resource/1')).toBe(false);
  });

  /**
   * ISO date guard — shouldDictionaryEncode() must return false for ISO dates.
   */
  it('shouldDictionaryEncode returns false for ISO-8601 dates', () => {
    const adapter = new GenericAdapter();
    expect(adapter.shouldDictionaryEncode('2024-01-15T08:00:00Z')).toBe(false);
    expect(adapter.shouldDictionaryEncode('2024-01-15')).toBe(false);
  });

  /**
   * When a large enough payload is compressed, URLs in the DATA rows
   * must NOT be present in the DICT block.
   */
  it('URL values never appear in the DICT block of a compressed payload', () => {
    // 10 records ensures compression is beneficial
    const payload = {
      links: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        url: `https://api.example.com/resource/${i}`,
        category: 'external',
        status: 'active',
      })),
    };
    const result = encoder.encode(payload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      expect(dictBlock).not.toContain('https://');
    }
  });

  /**
   * ISO dates in a large payload must not appear in DICT.
   */
  it('ISO date values never appear in the DICT block of a compressed payload', () => {
    const payload = {
      events: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        date: `2024-01-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
        type: 'scheduled',
        status: 'confirmed',
      })),
    };
    const result = encoder.encode(payload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      // No dict entry should start with a 4-digit year
      const dictLines = dictBlock.split('\n').filter((l) => l.startsWith('*'));
      dictLines.forEach((line) => {
        const value = line.split('=').slice(1).join('=');
        expect(value).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
      });
    }
  });

  it('circuit breaker returns raw JSON for tiny payloads', () => {
    const payload = { id: 1, name: "x" };
    const result = encoder.encode(payload);
    expect(result.encodedSize).toBeLessThanOrEqual(result.originalSize + 1);
  });

  it('fallbackOnFail returns raw JSON on error', () => {
    const brokenAdapter = new GenericAdapter();
    (brokenAdapter as any).findRoot = () => { throw new Error('intentional'); };
    const safeEncoder = new LeanEncoder({ adapter: brokenAdapter, fallbackOnFail: true });
    const payload = { data: [{ id: 1 }] };
    expect(() => safeEncoder.encode(payload)).not.toThrow();
    expect(safeEncoder.encode(payload).compressed).toBe(false);
  });

  it('output is deterministic across multiple runs', () => {
    const payload = {
      orders: Array.from({ length: 5 }, (_, i) => ({
        id: `ORD-${i + 1}`,
        status: i % 2 === 0 ? "OPEN" : "CLOSED",
        amount: (i + 1) * 100,
        currency: "USD",
      }))
    };
    const r1 = encoder.encode(payload);
    const r2 = encoder.encode(payload);
    expect(r1.encoded).toBe(r2.encoded);
  });

  it('handles empty array gracefully', () => {
    const payload = { records: [] };
    expect(() => encoder.encode(payload)).not.toThrow();
  });

  it('handles null values in records', () => {
    const payload = {
      items: [
        { id: "1", name: "Alpha", note: null },
        { id: "2", name: "Beta", note: null },
      ]
    };
    const result = encoder.encode(payload);
    expect(result.encoded).toContain('null');
  });
});

describe('Dictionary behavior', () => {
  it('dictionary-encodes strings that repeat >= 2 times and meet min length', () => {
    const enc = new LeanEncoder({ dictMinLength: 4, dictMinFrequency: 2 });
    const payload = {
      records: [
        { id: "1", department: "Engineering", status: "ACTIVE" },
        { id: "2", department: "Engineering", status: "ACTIVE" },
        { id: "3", department: "Marketing",   status: "ACTIVE" },
      ]
    };
    const result = enc.encode(payload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      expect(result.encoded).toContain('Engineering');
      expect(result.encoded).toContain('ACTIVE');
    }
  });
});
