import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { JwtPayload } from './types/jwt-payload.type';
import { User } from '../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before accessing ARC.',
      );
    }

    if (!user.accountEnabled) {
      throw new UnauthorizedException('Your account is disabled.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessGranted: user.accessGranted,
      stage2AccessGranted: user.stage2AccessGranted,
      accountEnabled: user.accountEnabled,
      emailVerified: user.emailVerified,
    };
  }
}
