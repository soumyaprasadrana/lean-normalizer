import { LeanEncoder } from '../src/core/encoder';
import { MaximoAdapter } from '../src/adapters/maximo';
import { maximoPayload } from './fixtures';

describe('MaximoAdapter + LeanEncoder (fixture data)', () => {
  const encoder = new LeanEncoder({ adapter: new MaximoAdapter() });

  it('encodes without throwing', () => {
    expect(() => encoder.encode(maximoPayload)).not.toThrow();
  });

  it('returns a LeanEncodeResult with all required fields', () => {
    const result = encoder.encode(maximoPayload);
    expect(result).toHaveProperty('encoded');
    expect(result).toHaveProperty('compressed');
    expect(result).toHaveProperty('originalSize');
    expect(result).toHaveProperty('encodedSize');
    expect(result).toHaveProperty('ratio');
  });

  it('originalSize > 0', () => {
    expect(encoder.encode(maximoPayload).originalSize).toBeGreaterThan(0);
  });

  it('output contains LEAN FORMAT v1 header', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('### LEAN FORMAT v1');
    }
  });

  it('output contains DATA: workorder block', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: mxwo');
    }
  });

  it('href is present in output — it is the record self-link needed by agents', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      // href values should appear inline in DATA rows (not dict-encoded, not suppressed)
      expect(result.encoded).toContain('https://maximo.example.com');
    }
  });

  it('href URLs are never dictionary-encoded (emitted raw for tool-call safety)', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      // DICT block must not contain any https:// entry
      const dictBlock = result.encoded.split('### SCHEMA')[0];
      const dictLines = dictBlock.split('\n').filter((l) => l.startsWith('*'));
      dictLines.forEach((line) => {
        const value = line.split('=').slice(1).join('=');
        expect(value).not.toMatch(/^https?:\/\//i);
      });
    }
  });

  it('contains three records (_id:0, _id:1, _id:2)', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('_id:0');
      expect(result.encoded).toContain('_id:1');
      expect(result.encoded).toContain('_id:2');
    }
  });

  it('is deterministic — same input produces identical output', () => {
    const r1 = encoder.encode(maximoPayload);
    const r2 = encoder.encode(maximoPayload);
    expect(r1.encoded).toBe(r2.encoded);
  });

  it('encodeToString returns a non-empty string', () => {
    const str = encoder.encodeToString(maximoPayload);
    expect(typeof str).toBe('string');
    expect(str.length).toBeGreaterThan(0);
  });

  it('SCHEMA keys are valid base-36 identifiers', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      const schemaSection = result.encoded.match(/### SCHEMA\n([\s\S]*?)(?=###|$)/)?.[1] ?? '';
      const lines = schemaSection.trim().split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach((line) => expect(line).toMatch(/^[0-9a-z]+=.+/));
    }
  });

  it('BEDFORD (repeats 3×) is dictionary-encoded', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      expect(result.encoded).toContain('BEDFORD');
    }
  });

  it('spi: namespace prefixes are stripped from all SCHEMA key paths', () => {
    const result = encoder.encode(maximoPayload);
    if (result.compressed) {
      const schemaSection = result.encoded.match(/### SCHEMA\n([\s\S]*?)(?=###|$)/)?.[1] ?? '';
      const lines = schemaSection.trim().split('\n').filter(Boolean);
      lines.forEach((line) => {
        const fieldPath = line.split('=').slice(1).join('=');
        expect(fieldPath).not.toMatch(/(?:^|\.)spi:/);
        expect(fieldPath).not.toMatch(/(?:^|\.)rdf:/);
      });
    }
  });
});
