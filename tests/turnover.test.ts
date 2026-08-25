import { describe, it, expect } from 'vitest';
import { TurnoverDeclaration } from '@prisma/client';
import { turnoverPrompt, DECLARATION_VALID_DAYS } from '@/shared/lib/turnover';

/**
 * What to ask a seller about the GST threshold, and when.
 *
 * Worth stating plainly: none of this detects anything. Seyon is a discovery
 * marketplace, buyers leave for WhatsApp, and no sale is ever recorded — so the
 * marketplace cannot know a seller's turnover and any code claiming to would be
 * inventing it. These rules decide when to ask, not what the answer is.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-08-25T00:00:00.000Z');

describe('turnoverPrompt', () => {
  it('asks a seller who has never been asked', () => {
    expect(
      turnoverPrompt(
        { turnoverDeclaration: TurnoverDeclaration.NOT_DECLARED, turnoverDeclaredAt: null, gstin: null },
        NOW
      )
    ).toEqual({ kind: 'never_asked' });
  });

  it('says nothing to a seller who answered recently', () => {
    expect(
      turnoverPrompt(
        {
          turnoverDeclaration: TurnoverDeclaration.BELOW_THRESHOLD,
          turnoverDeclaredAt: new Date(NOW.getTime() - 30 * DAY),
          gstin: null,
        },
        NOW
      )
    ).toEqual({ kind: 'none' });
  });

  it('asks again once the answer is a year old', () => {
    // The threshold is measured over a year, so an answer older than that says
    // nothing about now.
    const result = turnoverPrompt(
      {
        turnoverDeclaration: TurnoverDeclaration.BELOW_THRESHOLD,
        turnoverDeclaredAt: new Date(NOW.getTime() - (DECLARATION_VALID_DAYS + 5) * DAY),
        gstin: null,
      },
      NOW
    );
    expect(result.kind).toBe('stale');
  });

  it('does not ask again the day before it goes stale', () => {
    const result = turnoverPrompt(
      {
        turnoverDeclaration: TurnoverDeclaration.BELOW_THRESHOLD,
        turnoverDeclaredAt: new Date(NOW.getTime() - (DECLARATION_VALID_DAYS - 1) * DAY),
        gstin: null,
      },
      NOW
    );
    expect(result.kind).toBe('none');
  });

  it('chases the missing GSTIN ahead of anything else', () => {
    // A seller who has said they are over the threshold and given no GSTIN is a
    // live gap. Re-asking the turnover question would talk past it.
    const result = turnoverPrompt(
      {
        turnoverDeclaration: TurnoverDeclaration.ABOVE_THRESHOLD,
        turnoverDeclaredAt: new Date(NOW.getTime() - (DECLARATION_VALID_DAYS + 100) * DAY),
        gstin: null,
      },
      NOW
    );
    expect(result).toEqual({ kind: 'gstin_missing' });
  });

  it('says nothing to a seller above the threshold who gave a GSTIN', () => {
    expect(
      turnoverPrompt(
        {
          turnoverDeclaration: TurnoverDeclaration.ABOVE_THRESHOLD,
          turnoverDeclaredAt: new Date(NOW.getTime() - 10 * DAY),
          gstin: '29ABCPE1234F1Z5',
        },
        NOW
      )
    ).toEqual({ kind: 'none' });
  });

  it('treats a blank GSTIN as missing', () => {
    const result = turnoverPrompt(
      {
        turnoverDeclaration: TurnoverDeclaration.ABOVE_THRESHOLD,
        turnoverDeclaredAt: NOW,
        gstin: '   ',
      },
      NOW
    );
    expect(result.kind).toBe('gstin_missing');
  });

  it('asks a seller whose declaration lost its date somehow', () => {
    // The database refuses this combination, but a defaulted read or a future
    // migration could produce it, and asking again is the safe answer.
    const result = turnoverPrompt(
      { turnoverDeclaration: TurnoverDeclaration.BELOW_THRESHOLD, turnoverDeclaredAt: null, gstin: null },
      NOW
    );
    expect(result.kind).toBe('never_asked');
  });
});
