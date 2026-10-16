import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import type { AuthRequest } from 'src/auth/interface/auth-request.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('start')
  async start(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    //const userEmail = req.user.email;
    //console.log('🚀 START SESSION FOR USER:', userId);
    return this.sessionsService.startUserSession(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('progress/:sessionId')
  async progress(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    await this.sessionsService.validateSessionOwnership(
      sessionId,
      req.user.userId,
      req.user.role,
    );
    return this.sessionsService.getProgress(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active')
  getActive(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    return this.sessionsService.getActiveSession(userId);
  }
}
