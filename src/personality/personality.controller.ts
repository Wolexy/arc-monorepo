import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  //Req,
} from '@nestjs/common';
import { PersonalityService } from './personality.service';
import { JwtAuthGuard, AccessGuard } from '../auth/jwt-auth.guard';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
//import type { Request } from 'express';
import type { AuthRequest } from 'src/auth/interface/auth-request.interface';

@Controller('personality')
@UseGuards(JwtAuthGuard)
export class PersonalityController {
  constructor(
    private readonly personalityService: PersonalityService,
    //private readonly usersService: UsersService,
  ) {}

  @Get('access/:sessionId')
  checkAccess(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.personalityService.canAccessStage2(
      sessionId,
      req.user.userId,
      req.user.role,
    );
  }

  @UseGuards(AccessGuard)
  @Post('start/:sessionId')
  start(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.personalityService.startPersonality(
      sessionId,
      req.user.userId,
      req.user.role,
    );
  }

  @UseGuards(AccessGuard)
  @Get(':sessionId/:energyCenter/next')
  getNextQuestion(
    @Param('sessionId') sessionId: string,
    @Param('energyCenter') energyCenter: string,
    @Req() req: AuthRequest,
  ) {
    const center = energyCenter.toUpperCase() as 'GUT' | 'HEART' | 'HEAD';

    return this.personalityService.getNextQuestion(
      sessionId,
      center,
      req.user.userId,
      req.user.role,
    );
  }

  @UseGuards(AccessGuard)
  @Post(':sessionId/:energyCenter/answer')
  async submitAnswer(
    @Param('sessionId') sessionId: string,
    @Param('energyCenter') energyCenter: string,
    @Body() body: SubmitAnswerDto,
    @Req() req: AuthRequest,
  ) {
    const center = energyCenter.toUpperCase() as 'GUT' | 'HEART' | 'HEAD';

    return this.personalityService.submitAnswer(
      sessionId,
      center,
      body.questionId,
      body.rankChoiceId,
      req.user.userId,
      req.user.role,
    );
  }
  @UseGuards(AccessGuard)
  @Get('next-center/:sessionId')
  async nextCenter(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.personalityService.getNextEnergyCenter(
      sessionId,
      req.user.userId,
      req.user.role,
    );
  }
  //Legacy Debug Admin/Test only endpoint - can be removed later
  @UseGuards(AccessGuard)
  @Post(':sessionId/final')
  async getFinal(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.personalityService.aggregateFinalPersonality(
      sessionId,
      req.user.userId,
      req.user.role,
    );
  }

  @UseGuards(AccessGuard)
  @Get(':sessionId/report')
  getReport(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.personalityService.getFinalReport(
      sessionId,
      req.user.userId,
      req.user.role,
    );
  }
}
