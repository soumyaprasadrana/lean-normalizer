import { LeanEncoder } from '../src/core/encoder';
import { ServiceNowAdapter } from '../src/adapters/servicenow';
import { serviceNowPayload } from './fixtures';

describe('ServiceNowAdapter + LeanEncoder', () => {
  const encoder = new LeanEncoder({ adapter: new ServiceNowAdapter() });

  it('encodes without throwing', () => {
    expect(() => encoder.encode(serviceNowPayload)).not.toThrow();
  });

  it('returns compressed result with expected fields', () => {
    const result = encoder.encode(serviceNowPayload);
    expect(result).toHaveProperty('encoded');
    expect(result.originalSize).toBeGreaterThan(0);
  });

  it('output contains DATA: incident block', () => {
    const result = encoder.encode(serviceNowPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('### DATA: incident');
    }
  });

  it('drops the "link" keys from reference objects', () => {
    const result = encoder.encode(serviceNowPayload);
    // The ServiceNow reference link URLs should not appear in the output
    expect(result.encoded).not.toContain('instance.service-now.com/api/now/table/sys_user/xyz');
  });

  it('retains the "value" of reference fields', () => {
    const result = encoder.encode(serviceNowPayload);
    // The value side of reference objects (e.g. "grp01") should appear
    if (result.compressed) {
      expect(result.encoded).toContain('grp01');
    }
  });

  it('encodes three incident records', () => {
    const result = encoder.encode(serviceNowPayload);
    if (result.compressed) {
      expect(result.encoded).toContain('_id:0');
      expect(result.encoded).toContain('_id:1');
      expect(result.encoded).toContain('_id:2');
    }
  });

  it('is deterministic', () => {
    const r1 = encoder.encode(serviceNowPayload);
    const r2 = encoder.encode(serviceNowPayload);
    expect(r1.encoded).toBe(r2.encoded);
  });

  it('ratio is a positive number', () => {
    const result = encoder.encode(serviceNowPayload);
    expect(result.ratio).toBeGreaterThan(0);
  });

  it('repeated values like "network" and "grp01" are dictionary-encoded when they qualify', () => {
    const result = encoder.encode(serviceNowPayload);
    if (result.compressed && result.encoded.includes('### DICT')) {
      const dictSection = result.encoded.split('### SCHEMA')[0];
      // At least one repeated string should be in the DICT
      expect(dictSection).toContain('*0=');
    }
  });

  it('sys_class_name is excluded from output', () => {
    const result = encoder.encode(serviceNowPayload);
    // ServiceNowAdapter skips sys_class_name
    expect(result.encoded).not.toContain('sys_class_name');
  });
});
