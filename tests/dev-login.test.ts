import { describe, it, expect } from 'vitest';
import { isDevLoginEnabled } from '../src/backend/lib/dev-login';

describe('isDevLoginEnabled (credentials provider gating)', () => {
  it('is enabled in development', () => {
    expect(isDevLoginEnabled('development', undefined)).toBe(true);
  });

  it('is enabled in test', () => {
    expect(isDevLoginEnabled('test', undefined)).toBe(true);
  });

  it('is DISABLED in production by default', () => {
    expect(isDevLoginEnabled('production', undefined)).toBe(false);
  });

  it('stays disabled in production for any non-"true" override value', () => {
    expect(isDevLoginEnabled('production', 'false')).toBe(false);
    expect(isDevLoginEnabled('production', '1')).toBe(false);
    expect(isDevLoginEnabled('production', 'TRUE')).toBe(false);
    expect(isDevLoginEnabled('production', '')).toBe(false);
  });

  it('can be force-enabled with the explicit escape hatch', () => {
    expect(isDevLoginEnabled('production', 'true')).toBe(true);
  });
});
