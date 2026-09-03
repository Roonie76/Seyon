import { describe, it, expect } from 'vitest';
import {
  grievanceOfficer,
  isGrievanceOfficerAppointed,
} from '@/shared/data/legal-entity';
import { checkEnvironment } from '@/backend/lib/env-check';

/**
 * The failure this guards against is the one that actually shipped: the privacy
 * policy and the terms rendered `[Name]` and `[Designation]` to real visitors
 * because a template was published without being filled in.
 */

const complete = {
  NEXT_PUBLIC_GRIEVANCE_NAME: 'A. Sharma',
  NEXT_PUBLIC_GRIEVANCE_DESIGNATION: 'Grievance Officer',
  NEXT_PUBLIC_GRIEVANCE_EMAIL: 'grievance@seyon.in',
};

describe('grievanceOfficer', () => {
  it('returns the officer when name, designation and email are all set', () => {
    const officer = grievanceOfficer(complete);
    expect(officer).toEqual({
      name: 'A. Sharma',
      designation: 'Grievance Officer',
      email: 'grievance@seyon.in',
      address: null,
    });
  });

  it('includes the postal address when one is provided', () => {
    expect(
      grievanceOfficer({ ...complete, NEXT_PUBLIC_GRIEVANCE_ADDRESS: '12 MG Road, Chennai' })
        ?.address
    ).toBe('12 MG Road, Chennai');
  });

  it('is unappointed when nothing is configured', () => {
    expect(grievanceOfficer({})).toBeNull();
    expect(isGrievanceOfficerAppointed({})).toBe(false);
  });

  it.each([
    ['name', 'NEXT_PUBLIC_GRIEVANCE_NAME'],
    ['designation', 'NEXT_PUBLIC_GRIEVANCE_DESIGNATION'],
    ['email', 'NEXT_PUBLIC_GRIEVANCE_EMAIL'],
  ])('is unappointed when %s is missing', (_label, key) => {
    const partial: Record<string, string | undefined> = { ...complete };
    delete partial[key];
    expect(grievanceOfficer(partial)).toBeNull();
  });

  it('treats an unfilled bracket template as unset, not as a name', () => {
    // This is the exact string that was rendering on the live pages.
    expect(
      grievanceOfficer({ ...complete, NEXT_PUBLIC_GRIEVANCE_NAME: '[Name]' })
    ).toBeNull();
  });

  it.each(['TBD', 'todo', 'xxx', '   '])('treats %j as unset', (placeholder) => {
    expect(
      grievanceOfficer({ ...complete, NEXT_PUBLIC_GRIEVANCE_EMAIL: placeholder })
    ).toBeNull();
  });

  it('trims surrounding whitespace off real values', () => {
    expect(grievanceOfficer({ ...complete, NEXT_PUBLIC_GRIEVANCE_NAME: '  A. Sharma  ' })?.name)
      .toBe('A. Sharma');
  });
});

describe('checkEnvironment: grievance officer', () => {
  it('warns when no officer is appointed', () => {
    const { warnings } = checkEnvironment({} as NodeJS.ProcessEnv);
    expect(warnings.some((w) => w.startsWith('NEXT_PUBLIC_GRIEVANCE_*'))).toBe(true);
  });

  it('stays quiet once one is appointed', () => {
    const { warnings } = checkEnvironment(complete as unknown as NodeJS.ProcessEnv);
    expect(warnings.some((w) => w.startsWith('NEXT_PUBLIC_GRIEVANCE_*'))).toBe(false);
  });

  it('is a warning, not fatal — the pages degrade honestly rather than 500', () => {
    const { fatal } = checkEnvironment({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a-real-secret-value-of-sufficient-length',
      DATABASE_URL: 'postgresql://localhost/seyon',
      SUPABASE_URL: 'https://real.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      WHATSAPP_CLOUD_TOKEN: 'cloud-token',
      WHATSAPP_PHONE_NUMBER_ID: '109876543210987',
      WHATSAPP_VERIFY_TEMPLATE_NAME: 'seyon_verification_code',
    } as NodeJS.ProcessEnv);
    expect(fatal).toEqual([]);
  });
});
