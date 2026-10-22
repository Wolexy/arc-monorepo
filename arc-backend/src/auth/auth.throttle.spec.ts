import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { buildThrottlerOptions } from '../common/throttle.config';

// Stands in for an authenticated assessment endpoint on the default limit.
@Controller('probe')
class ProbeController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('Rate limiting (real ThrottlerModule config and guard)', () => {
  let app: INestApplication<App>;

  const authService = {
    register: jest.fn().mockResolvedValue({ message: 'registered' }),
    login: jest
      .fn()
      .mockResolvedValue({ accessToken: 'token', user: { id: 1 } }),
    verifyEmail: jest.fn().mockResolvedValue({ message: 'verified' }),
  };

  const statuses = async (count: number, send: () => request.Test) => {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push((await send()).status);
    }
    return result;
  };

  // A fresh app per test gives each test its own throttle window.
  beforeEach(async () => {
    delete process.env.THROTTLE_LIMIT;
    delete process.env.THROTTLE_TTL_MS;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: buildThrottlerOptions,
        }),
      ],
      controllers: [AuthController, ProbeController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows five logins per minute and rejects the sixth', async () => {
    const codes = await statuses(6, () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'secret' }),
    );

    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });

  it('allows five registrations per minute and rejects the sixth', async () => {
    const codes = await statuses(6, () =>
      request(app.getHttpServer()).post('/auth/register').send({
        email: 'user@example.com',
        password: 'secret',
        confirmPassword: 'secret',
      }),
    );

    expect(codes.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(codes[5]).toBe(429);
  });

  it('allows ten email verifications per minute and rejects the eleventh', async () => {
    const codes = await statuses(11, () =>
      request(app.getHttpServer()).get('/auth/verify-email?token=abc'),
    );

    expect(codes.slice(0, 10).every((code) => code === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  it('lets assessment traffic through well past 200 requests, still capped at 300', async () => {
    const codes = await statuses(301, () =>
      request(app.getHttpServer()).get('/probe'),
    );

    expect(codes.slice(0, 300).every((code) => code === 200)).toBe(true);
    expect(codes[300]).toBe(429);
  });

  it('counts auth limits separately from the default limit', async () => {
    await statuses(5, () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'secret' }),
    );

    // Login is now exhausted, but other routes are unaffected.
    const probe = await request(app.getHttpServer()).get('/probe');
    expect(probe.status).toBe(200);
  });
});
