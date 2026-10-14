import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import { LoginDto } from './dto/login.dto';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /* ---------------------------
     REGISTER ENDPOINT
  ----------------------------*/
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(
    @Body()
    body: RegisterDto,
  ) {
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    return this.auth.register(body.email, body.password);
  }

  /* ---------------------------
     LOGIN ENDPOINT
  ----------------------------*/
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || 'unknown';

    // use this when using proxy server like nginx /cloud
    //const ip = req.headers['x-forwarded-for'] || req.ip;

    const userAgent = req.headers['user-agent'] || 'unknown';
    const result = await this.auth.login(
      dto.email,
      dto.password,
      ip,
      userAgent,
    );

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    return {
      user: result.user,
    };

    //return this.auth.login(dto.email, dto.password, ip, userAgent);
  }

  /* ---------------------------
     EMAIL VERIFICATION
  ----------------------------*/
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  /* ---------------------------
     Logout Endpoint
  ----------------------------*/
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return {
      message: 'Logged out successfully',
    };
  }
}
