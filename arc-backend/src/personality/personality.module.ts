import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PersonalityController } from './personality.controller';
import { PersonalityService } from './personality.service';
import { PersonalitySession } from './entities/personality-session.entity';
import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityAnswerOption } from './entities/personality-answer-option.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityResultBreakdown } from './entities/personality-result-breakdown.entity';
import { PersonalityRankChoice } from './entities/personality-rank-choice.entity';
import { FinalPersonalityResult } from './entities/final-personality-result.entity';
import { TestSession } from '../sessions/entities/test-session.entity';
import { User } from 'src/users/entities/user.entity';
import { PersonalityType } from './entities/personality-type.entity';
import { PersonalityTypeDescription } from './entities/personality-type-description.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TestSession,
      PersonalityQuestion,
      PersonalityAnswerOption,
      PersonalityResponse,
      PersonalitySession,
      PersonalityResultBreakdown,
      PersonalityRankChoice,
      FinalPersonalityResult,
      PersonalityType,
      PersonalityTypeDescription,
      User,
    ]),
    UsersModule,
  ],
  controllers: [PersonalityController],
  providers: [PersonalityService],
})
export class PersonalityModule {}
