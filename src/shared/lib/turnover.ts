import { TurnoverDeclaration } from '@prisma/client';

/**
 * The GST registration threshold, and what the marketplace can honestly say
 * about it.
 *
 * The original plan for this assumed a turnover signal to watch. There is none.
 * Seyon is a discovery marketplace: a buyer finds a store, taps through to
 * WhatsApp, and everything after that happens somewhere Seyon cannot see. There
 * is no order model, no payment record, no line item anywhere in the schema —
 * the only events recorded are shop views, product views and WhatsApp clicks.
 *
 * So the marketplace cannot detect a seller crossing the threshold, and code
 * that claimed to would be inventing a number. What it can do is ask, record
 * the answer with the date it was given, and ask again when that answer is old
 * enough to be wrong.
 *
 * The thresholds themselves are stated here rather than in the copy so that a
 * change to the law is one edit.
 */

/** Goods: ₹40 lakh in most states. */
export const GST_THRESHOLD_GOODS = 4_000_000;

/** Services: ₹20 lakh. */
export const GST_THRESHOLD_SERVICES = 2_000_000;

/**
 * How long a declaration stands before it is worth asking again.
 *
 * A year, because that is the period the threshold itself is measured over. A
 * seller who was below it last April may not be this April, and nothing in the
 * marketplace would show it.
 */
export const DECLARATION_VALID_DAYS = 365;

export interface TurnoverState {
  turnoverDeclaration: TurnoverDeclaration;
  turnoverDeclaredAt: Date | null;
  gstin: string | null;
}

export type TurnoverPrompt =
  | { kind: 'none' }
  | { kind: 'never_asked' }
  | { kind: 'stale'; daysOld: number }
  | { kind: 'gstin_missing' };

/**
 * What, if anything, to put in front of this seller.
 *
 * `gstin_missing` outranks staleness: a seller who has said they are over the
 * threshold and has not given a GSTIN is a live gap, and re-asking the turnover
 * question would talk past it.
 */
export function turnoverPrompt(state: TurnoverState, now: Date = new Date()): TurnoverPrompt {
  const { turnoverDeclaration, turnoverDeclaredAt, gstin } = state;

  if (turnoverDeclaration === TurnoverDeclaration.ABOVE_THRESHOLD && !gstin?.trim()) {
    return { kind: 'gstin_missing' };
  }

  if (turnoverDeclaration === TurnoverDeclaration.NOT_DECLARED || !turnoverDeclaredAt) {
    return { kind: 'never_asked' };
  }

  const daysOld = Math.floor((now.getTime() - turnoverDeclaredAt.getTime()) / 86_400_000);
  if (daysOld >= DECLARATION_VALID_DAYS) {
    return { kind: 'stale', daysOld };
  }

  return { kind: 'none' };
}

/** Formats a rupee threshold the way an Indian seller would read it. */
export function formatThreshold(paiseFreeRupees: number): string {
  const lakh = paiseFreeRupees / 100_000;
  return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} lakh`;
}
