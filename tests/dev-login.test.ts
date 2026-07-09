import { describe, it, expect } from 'vitest';
import { isDevLoginEnabled } from '../src/backend/lib/dev-login';

describe('isDevLoginEnabled (credentials provider gating)', () => {
  it('is DISABLED by default', () => {
    expect(isDevLoginEnabled(undefined)).toBe(false);
  });

  it('stays disabled for any non-"true" override value', () => {
    expect(isDevLoginEnabled('false')).toBe(false);
    expect(isDevLoginEnabled('1')).toBe(false);
    expect(isDevLoginEnabled('TRUE')).toBe(false);
    expect(isDevLoginEnabled('')).toBe(false);
  });

  it('can be force-enabled with the explicit escape hatch', () => {
    expect(isDevLoginEnabled('true')).toBe(true);
  });
});
