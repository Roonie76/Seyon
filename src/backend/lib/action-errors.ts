import { Prisma } from '@prisma/client';
import { logger } from './logger';

/**
 * Turn any thrown value into a message that is safe to show a seller.
 *
 * Server actions previously returned `error.message` straight from the catch
 * block, so a slug race or a double delete sent the client a raw Prisma
 * exception — internal file paths, query fragments and constraint names
 * included. The real error is still logged; only the wording changes.
 */

export const GENERIC_ERROR =
  'Something went wrong on our side. Please try again in a moment.';

export const CONFLICT_ERROR =
  'This item was changed somewhere else while you were editing. Reload the page and try again.';

/** Error messages we raise deliberately and are safe to pass through. */
const SAFE_MESSAGES = new Set([
  'Unauthenticated',
  'Unauthorized store management',
  'Shop not found',
  'Invalid shop ID format',
  'Product not found',
  CONFLICT_ERROR,
]);

export function toUserMessage(error: unknown, context?: Record<string, unknown>): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[]).join(', ')
          : String(error.meta?.target ?? '');
        if (target.includes('slug')) {
          return 'Another listing just took that web address. Change the title slightly and save again.';
        }
        return 'That value is already in use. Pick a different one.';
      }
      case 'P2025':
        return 'That item no longer exists — it may have been deleted from another tab.';
      case 'P2003':
        return 'That item is linked to something else and cannot be changed right now.';
      default:
        break;
    }
  }

  if (error instanceof Error && SAFE_MESSAGES.has(error.message)) {
    return error.message;
  }

  logger.error('Unexpected error in server action', error, context);
  return GENERIC_ERROR;
}

/** True when the failure is a unique-constraint collision. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}
