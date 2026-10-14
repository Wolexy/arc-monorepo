import { Controller, Get, Param, Body, Post, Req } from '@nestjs/common';
import { EnergyService } from './energy.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitEnergyDto } from './dto/submit-energy.dto';
import type { AuthRequest } from 'src/auth/interface/auth-request.interface';

@UseGuards(JwtAuthGuard)
@Controller('energy')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Get('next/:sessionId')
  async next(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.energyService.getNextGroup(sessionId, req.user.userId);
  }

  @Post('submit')
  async submit(@Body() body: SubmitEnergyDto, @Req() req: AuthRequest) {
    return this.energyService.submitGroupRanking(
      body.sessionId,
      req.user.userId,
      body.energyStatementGroupId,
      body.rankings,
    );
  }

  @Post('finish/:sessionId')
  async finish(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.energyService.finishStage1(sessionId, req.user.userId);
  }

  @Get('result/:sessionId')
  async getResult(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.energyService.getStage1Result(sessionId, req.user.userId);
  }
  
  @Post('unlock/:sessionId')
  async unlock(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.energyService.unlockStage2(sessionId, req.user.userId);
  }
}
