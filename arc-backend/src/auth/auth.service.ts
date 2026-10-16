import { TokenUtil } from './../common/utils/token.util';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { UserLoginHistory } from './entities/user-login-history.entity';
import { JwtPayload } from './types/jwt-payload.type';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserLoginHistory)
    private loginHistoryRepo: Repository<UserLoginHistory>,

    private jwtService: JwtService,

    private mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /* ---------------------------
     REGISTER USER
  ----------------------------*/
  async register(email: string, password: string) {
    const existing = await this.userRepo.findOne({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const saltRounds = Number(
      this.configService.getOrThrow('BCRYPT_SALT_ROUNDS'),
    );
    const token = TokenUtil.generate(); //randomBytes(32).toString('hex');

    const hash = await bcrypt.hash(password, saltRounds);

    const expiryHours = Number(
      this.configService.getOrThrow<number>('EMAIL_VERIFICATION_EXPIRY_HOURS'),
    );

    const user = this.userRepo.create({
      email: email,
      passwordHash: hash,
      role: 'USER',
      accessGranted: true,
      stage2AccessGranted: false,
      accountEnabled: true,
      emailVerified: false,
      emailVerificationToken: token,
      emailVerificationExpires: TokenUtil.expiresInHours(expiryHours),
      createdAt: new Date(),
    });

    await this.userRepo.save(user);
    await this.mailService.sendVerification(email, token);

    return {
      message: 'User registered successfully, Please verify your email.',
    };
  }

  /* ---------------------------
     LOGIN USER
  ----------------------------*/
  async login(email: string, password: string, ip: string, userAgent: string) {
    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    if (!user.accountEnabled) {
      throw new UnauthorizedException(
        'Your account has been disabled. Please contact the administrator.',
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accessGranted: user.accessGranted,
      stage2AccessGranted: user.stage2AccessGranted,
      accountEnabled: user.accountEnabled,
      emailVerified: user.emailVerified,
    };

    const token: string = this.jwtService.sign(payload);

    /* update login tracking (existing logic preserved) */
    await this.userRepo.update(user.id, {
      lastLoginAt: new Date(),
    });

    /* store login history (new feature) */
    await this.loginHistoryRepo.save({
      userId: user.id,
      ipAddress: ip,
      userAgent: userAgent,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        accessGranted: user.accessGranted,
        stage2AccessGranted: user.stage2AccessGranted,
        accountEnabled: user.accountEnabled,
        emailVerified: user.emailVerified,
      },
    };
  }//login end

  async verifyEmail(token: string) {
    const user = await this.userRepo.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (
      user.emailVerificationExpires &&
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException(
        'Verification link has expired. Please request a new verification email.',
      );
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await this.userRepo.save(user);

    return {
      message: 'Email verified successfully',
    };
  }
}
