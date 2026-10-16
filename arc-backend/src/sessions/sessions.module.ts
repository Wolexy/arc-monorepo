import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { TestSession } from './entities/test-session.entity';
import { User } from '../users/entities/user.entity';
import { EnergyResultEligibleCenter } from 'src/energy/entities/energy-result-eligible.entity';
import { PersonalitySession } from '../personality/entities/personality-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TestSession,
      User,
      EnergyResultEligibleCenter,
      PersonalitySession,
    ]),
  ],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
