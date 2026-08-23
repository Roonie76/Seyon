// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readConsent, setConsent, CONSENT_KEY } from '@/frontend/lib/consent';

/**
 * The property that matters: nothing is tracked until someone has said yes.
 * Every path that is not an explicit stored 'granted' must read as not granted,
 * including the ones where storage itself fails.
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analytics consent', () => {
  it('starts unset, so nothing is tracked before a choice is made', () => {
    expect(readConsent()).toBe('unset');
  });

  it('round-trips a granted decision', () => {
    setConsent('granted');
    expect(readConsent()).toBe('granted');
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('granted');
  });

  it('round-trips a denied decision, so the banner does not come back', () => {
    setConsent('denied');
    expect(readConsent()).toBe('denied');
  });

  it('treats a corrupted or tampered value as unset rather than as consent', () => {
    window.localStorage.setItem(CONSENT_KEY, 'yes-please');
    expect(readConsent()).toBe('unset');
  });

  it('reads as unset when storage throws, rather than assuming permission', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    expect(readConsent()).toBe('unset');
  });

  it('does not throw when storage refuses a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota');
    });
    expect(() => setConsent('granted')).not.toThrow();
  });

  it('notifies same-tab listeners so the banner and PostHog agree immediately', () => {
    const listener = vi.fn();
    window.addEventListener('seyon-cart-updated', listener);
    setConsent('granted');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('seyon-cart-updated', listener);
  });
});
