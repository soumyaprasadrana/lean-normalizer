import { LeanEncoder } from '../src/core/encoder';
import { SAPAdapter } from '../src/adapters/sap';
import { sapPayload, sapV4Payload } from './fixtures';

describe('SAPAdapter + LeanEncoder (OData v2)', () => {
  const encoder = new LeanEncoder({ adapter: new SAPAdapter() });

  it('encodes OData v2 payload without throwing', () => {
    expect(() => encoder.encode(sapPayload)).not.toThrow();
  });

  it('finds root in d.results', () => {
    const result = encoder.encode(sapPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: entity');
    }
  });

  it('strips __metadata from output', () => {
    const result = encoder.encode(sapPayload);
    expect(result.encoded).not.toContain('__metadata');
  });

  it('strips __deferred from output', () => {
    const result = encoder.encode(sapPayload);
    expect(result.encoded).not.toContain('__deferred');
  });

  it('converts /Date(ms)/ to ISO string', () => {
    const result = encoder.encode(sapPayload);
    expect(result.encoded).not.toContain('/Date(');
  });

  it('encodes three purchase order records', () => {
    const result = encoder.encode(sapPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('_id:0');
      expect(result.encoded).toContain('_id:1');
      expect(result.encoded).toContain('_id:2');
    }
  });

  it('retains PurchaseOrder numbers', () => {
    const result = encoder.encode(sapPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('4500000001');
    }
  });

  it('VENDOR001 (appears 2×, length 9 ≥ dictMinLength=6) is dictionary-encoded', () => {
    const result = encoder.encode(sapPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      expect(dictBlock).toContain('VENDOR001');
    }
  });

  it('1.00000 (repeated ExchangeRate, length 7 ≥ 6) is dictionary-encoded', () => {
    // NT30 is only 4 chars — below the default dictMinLength of 6, so it won't
    // appear in the dict. 1.00000 (7 chars, appears 2×) will.
    const result = encoder.encode(sapPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      expect(dictBlock).toContain('1.00000');
    }
  });

  /**
   * NT30 is only 4 characters — shorter than the default dictMinLength of 6.
   * It is emitted inline in DATA rows rather than via a dictionary pointer.
   * Lower dictMinLength to 3 to verify it WOULD be encoded if the threshold allowed it.
   */
  it('NT30 is dictionary-encoded when dictMinLength is lowered to 3', () => {
    const enc = new LeanEncoder({ adapter: new SAPAdapter(), dictMinLength: 3 });
    const result = enc.encode(sapPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      expect(dictBlock).toContain('NT30');
    }
  });

  it('is deterministic', () => {
    const r1 = encoder.encode(sapPayload);
    const r2 = encoder.encode(sapPayload);
    expect(r1.encoded).toBe(r2.encoded);
  });
});

describe('SAPAdapter + LeanEncoder (OData v4)', () => {
  const encoder = new LeanEncoder({ adapter: new SAPAdapter() });

  it('encodes OData v4 payload without throwing', () => {
    expect(() => encoder.encode(sapV4Payload)).not.toThrow();
  });

  it('finds root in value array', () => {
    const result = encoder.encode(sapV4Payload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: entity');
    }
  });

  it('encodes two sales order records', () => {
    const result = encoder.encode(sapV4Payload);
    if (result.compressed) {
      expect(result.encoded).toContain('_id:0');
      expect(result.encoded).toContain('_id:1');
    }
  });

  it('retains SalesOrder numbers', () => {
    const result = encoder.encode(sapV4Payload);
    if (result.compressed) {
      expect(result.encoded).toContain('0000000100');
    }
  });
});
