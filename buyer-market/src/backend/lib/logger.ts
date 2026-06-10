import * as Sentry from '@sentry/nextjs';

/**
 * Dependency-free structured logger.
 *
 * Emits single-line JSON in production (machine-parseable by Vercel,
 * Datadog, Sentry breadcrumbs, etc.) and readable output in development.
 * Swap the sink here if/when a real logging service is added.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function serializeError(err: unknown): LogContext {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, stack: err.stack };
  }
  return { errorMessage: String(err) };
}

function emit(level: Level, message: string, context?: LogContext, err?: unknown) {
  const entry: LogContext = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ?? {}),
    ...(err !== undefined ? serializeError(err) : {}),
  };

  const line =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(entry)
      : `[${level.toUpperCase()}] ${message}${context ? ' ' + JSON.stringify(context) : ''}${err ? '\n' + String(err instanceof Error ? err.stack : err) : ''}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  if (level === 'error' && err !== undefined && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
    Sentry.captureException(err, {
      extra: {
        message,
        ...context,
      },
    });
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', message, context);
  },
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, err?: unknown, context?: LogContext) => emit('error', message, context, err),
};
