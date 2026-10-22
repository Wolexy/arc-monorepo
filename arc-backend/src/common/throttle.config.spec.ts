import { ConfigService } from '@nestjs/config';

import {
  buildThrottlerOptions,
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
} from './throttle.config';

describe('buildThrottlerOptions', () => {
  const saved = {
    limit: process.env.THROTTLE_LIMIT,
    ttl: process.env.THROTTLE_TTL_MS,
  };

  // ConfigService also reads process.env, so keep it out of these tests.
  beforeEach(() => {
    delete process.env.THROTTLE_LIMIT;
    delete process.env.THROTTLE_TTL_MS;
  });

  afterAll(() => {
    if (saved.limit !== undefined) process.env.THROTTLE_LIMIT = saved.limit;
    if (saved.ttl !== undefined) process.env.THROTTLE_TTL_MS = saved.ttl;
  });

  it('defaults to 300 requests per 60 seconds', () => {
    expect(DEFAULT_THROTTLE_LIMIT).toBe(300);
    expect(DEFAULT_THROTTLE_TTL_MS).toBe(60_000);
    expect(buildThrottlerOptions(new ConfigService({}))).toEqual([
      { limit: 300, ttl: 60_000 },
    ]);
  });

  it('uses THROTTLE_LIMIT and THROTTLE_TTL_MS when set', () => {
    const config = new ConfigService({
      THROTTLE_LIMIT: '120',
      THROTTLE_TTL_MS: '30000',
    });

    expect(buildThrottlerOptions(config)).toEqual([
      { limit: 120, ttl: 30_000 },
    ]);
  });

  it('treats empty values as unset', () => {
    const config = new ConfigService({
      THROTTLE_LIMIT: '',
      THROTTLE_TTL_MS: '',
    });

    expect(buildThrottlerOptions(config)).toEqual([
      { limit: 300, ttl: 60_000 },
    ]);
  });

  it.each(['0', '-5', '1.5', 'abc'])(
    'rejects an invalid THROTTLE_LIMIT of "%s"',
    (value) => {
      const config = new ConfigService({ THROTTLE_LIMIT: value });

      expect(() => buildThrottlerOptions(config)).toThrow(
        'THROTTLE_LIMIT must be a positive integer',
      );
    },
  );

  it('rejects an invalid THROTTLE_TTL_MS', () => {
    const config = new ConfigService({ THROTTLE_TTL_MS: 'soon' });

    expect(() => buildThrottlerOptions(config)).toThrow(
      'THROTTLE_TTL_MS must be a positive integer',
    );
  });
});
