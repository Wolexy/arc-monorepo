import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnergyService } from './energy.service';
import { EnergyController } from './energy.controller';
import { EnergyResult } from './entities/energy-result.entity';
import { EnergyStatementGroup } from './entities/energy-statement-group.entity';
import { EnergyStatement } from './entities/energy-statement.entity';
import { EnergyGroupResponse } from './entities/energy-group-response.entity';
import { EnergyStatementRanking } from './entities/energy-statement-ranking.entity';
import { EnergyResultEligibleCenter } from './entities/energy-result-eligible.entity';
import { TestSession } from 'src/sessions/entities/test-session.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnergyStatementGroup,
      EnergyStatement,
      EnergyGroupResponse,
      EnergyStatementRanking,
      EnergyResult,
      EnergyResultEligibleCenter,
      TestSession,
      User,
    ]),
  ],
  controllers: [EnergyController],
  providers: [EnergyService],
})
export class EnergyModule {}
