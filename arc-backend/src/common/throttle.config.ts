import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export const DEFAULT_THROTTLE_LIMIT = 300;
export const DEFAULT_THROTTLE_TTL_MS = 60_000;

// Reads a positive whole number from config, or uses the default when unset.
// An invalid value fails startup rather than silently changing the limit.
function readPositiveInt(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string | number>(key);

  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer, received "${raw}"`);
  }

  return value;
}

// Global per-client limit applied to every route by ThrottlerGuard.
// Routes that need stricter limits (login, register, verify-email)
// override it with @Throttle.
export function buildThrottlerOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  return [
    {
      ttl: readPositiveInt(config, 'THROTTLE_TTL_MS', DEFAULT_THROTTLE_TTL_MS),
      limit: readPositiveInt(config, 'THROTTLE_LIMIT', DEFAULT_THROTTLE_LIMIT),
    },
  ];
}
