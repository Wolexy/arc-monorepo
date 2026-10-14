import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnergyStatementGroup } from './entities/energy-statement-group.entity';
import { EnergyStatement } from './entities/energy-statement.entity';
import { EnergyGroupResponse } from './entities/energy-group-response.entity';
import { EnergyStatementRanking } from './entities/energy-statement-ranking.entity';
import { EnergyResult } from './entities/energy-result.entity';
import { EnergyResultEligibleCenter } from './entities/energy-result-eligible.entity';
import { TestSession } from 'src/sessions/entities/test-session.entity';
import { EnergyScoreRow } from '../energy/dto/energy-score-row.dto';
import { User } from 'src/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnergyService implements OnModuleInit {
  private totalGroups!: number;
  constructor(
    @InjectRepository(EnergyStatementGroup)
    private groupRepo: Repository<EnergyStatementGroup>,

    @InjectRepository(EnergyStatement)
    private statementRepo: Repository<EnergyStatement>,

    @InjectRepository(EnergyGroupResponse)
    private responseRepo: Repository<EnergyGroupResponse>,

    @InjectRepository(EnergyStatementRanking)
    private rankingRepo: Repository<EnergyStatementRanking>,

    @InjectRepository(EnergyResult)
    private energyResultRepo: Repository<EnergyResult>,

    @InjectRepository(EnergyResultEligibleCenter)
    private energyEligibleRepo: Repository<EnergyResultEligibleCenter>,

    @InjectRepository(TestSession)
    private sessionRepo: Repository<TestSession>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.totalGroups = await this.groupRepo.count({
      where: { stageId: 1 },
    });
  }

  /*=====================================================
    Validate Session Ownership 
========================================================*/

  private async validateSessionOwnership(
    sessionId: string,
    userId: number,
  ): Promise<TestSession> {
    const session = await this.sessionRepo.findOne({
      where: {
        id: sessionId,
        userId,
      },
    });
    if (!session) {
      throw new ForbiddenException(
        'Assessment session not found or access denied.',
      );
    }
    return session;
  }

  //==========================GetNextGroup==========================

  async getNextGroup(sessionId: string, userId: number) {
    await this.validateSessionOwnership(sessionId, userId);

    // 1. Find groups already answered
    const answered = await this.responseRepo.find({
      where: { sessionId },
    });

    const answeredGroupIds = answered.map((r) => r.energyStatementGroupId);

    // 2. Find next group
    const nextGroup = await this.groupRepo
      .createQueryBuilder('g')
      .where('g.stage_id = :stageId', { stageId: 1 })
      .andWhere(answeredGroupIds.length ? 'g.id NOT IN (:...ids)' : '1=1', {
        ids: answeredGroupIds,
      })
      .orderBy('g.group_no', 'ASC')
      .getOne();

    if (!nextGroup) {
      return {
        completed: true,
        stage: 'ENERGY',
        message: 'Energy assessment completed',
      }; // Stage 1 complete
    }

    // may fetch totalGroups instead of from constructor
    //const totalGroups = await this.groupRepo.count();

    // 3. Fetch statements
    const statements = await this.statementRepo.find({
      where: { groupId: nextGroup.id },
      order: { id: 'ASC' },
    });

    return {
      groupId: nextGroup.id,
      groupNo: nextGroup.groupNo,
      totalGroups: this.totalGroups,
      statements,
    };
  }

  async submitGroupRanking(
    sessionId: string,
    userId: number,
    energyStatementGroupId: number,
    rankings: { statementId: number; rankId: number }[],
  ) {
    await this.validateSessionOwnership(sessionId, userId);

    // 1. Validate exactly 3 rankings
    const statements = await this.statementRepo.count({
      where: { groupId: energyStatementGroupId },
    });

    if (rankings.length !== statements) {
      throw new BadRequestException(`Exactly ${statements} rankings required`);
    }

    // 2. Validate unique ranks
    const rankIds = rankings.map((r) => r.rankId);
    if (new Set(rankIds).size !== statements) {
      throw new ConflictException('Ranks must be unique');
    }

    // 3. Prevent duplicate submission
    const existing = await this.responseRepo.findOne({
      where: {
        sessionId,
        energyStatementGroupId,
      },
    });

    if (existing) {
      throw new BadRequestException('This group has already been submitted');
    }

    // 4. Create group response
    const groupResponse = await this.responseRepo.save({
      sessionId,
      energyStatementGroupId,
    });

    // 5. Create statement rankings
    const records = rankings.map((r) => ({
      groupResponseId: groupResponse.id,
      statementId: r.statementId,
      rankId: r.rankId,
    }));

    await this.rankingRepo.save(records);

    return { success: true };
  } //End getNextGroup

  ///////////////////////////////////////@ts-check

  async finishStage1(sessionId: string, userId: number) {
    /* -----------------------------------------
     1️⃣ Ensure all groups completed
  ------------------------------------------ */
    await this.validateSessionOwnership(sessionId, userId);

    // Return the existing result if Stage 1 has already been completed.
    const existingResult = await this.getStage1Result(sessionId, userId);

    if (existingResult) {
      return existingResult;
    }

    const totalGroups = await this.groupRepo.count({
      where: {
        stageId: 1,
      },
    });

    const completedGroups = await this.responseRepo.count({
      where: { sessionId },
    });

    if (completedGroups < totalGroups) {
      throw new BadRequestException('Energy assessment is not yet complete');
    }

    /* -----------------------------------------
     2️⃣ Aggregate scores (case-safe)
  ------------------------------------------ */
    const rows = await this.statementRepo
      .createQueryBuilder('s')
      .innerJoin('energy_statement_rankings', 'r', 'r.statement_id = s.id')
      .innerJoin('energy_rank_choices', 'rc', 'rc.id = r.rank_id')
      .innerJoin('energy_group_responses', 'gr', 'gr.id = r.group_response_id')
      .where('gr.session_id = :sessionId', { sessionId })
      .select([
        'UPPER(s.personality_type) AS personalitytype',
        'SUM(rc.weight) AS score',
      ])
      .groupBy('UPPER(s.personality_type)')
      .getRawMany<EnergyScoreRow>();

    const totals: Record<string, number> = {
      GUT: 0,
      HEART: 0,
      HEAD: 0,
    };

    for (const row of rows) {
      totals[row.personalitytype] = Number(row.score);
    }

    const gut = totals.GUT;
    const heart = totals.HEART;
    const head = totals.HEAD;

    /* -----------------------------------------
     3️⃣ Determine dominant (tie-safe)
  ------------------------------------------ */
    const scores = [
      { center: 'GUT', score: gut },
      { center: 'HEART', score: heart },
      { center: 'HEAD', score: head },
    ].sort((a, b) => b.score - a.score);

    const topScore = scores[0].score;

    const topCenters = scores
      .filter((s) => s.score === topScore)
      .map((s) => s.center);

    const dominant = topCenters.length === 1 ? topCenters[0] : null;

    /* -----------------------------------------
     4️⃣ Determine eligible centers (Option B)
  ------------------------------------------ */
    let eligibleCenters: string[];

    // Case 1 — Strong dominant (>=35)
    if (topScore >= 35) {
      eligibleCenters = [scores[0].center];
    }

    // Case 2 — Medium dominant (30–34)
    else if (topScore >= 30) {
      // Include ALL centers tied at top score
      eligibleCenters = scores
        .filter((s) => s.score === topScore)
        .map((s) => s.center);

      // If only one tied at top, include second highest as well
      if (eligibleCenters.length === 1) {
        eligibleCenters.push(scores[1].center);
      }
    }

    // Case 3 — Low scores (<30)
    else {
      eligibleCenters = scores.map((s) => s.center);
    }
    /* -----------------------------------------
     5️⃣ Persist energy result
  ------------------------------------------ */
    await this.energyResultRepo.save({
      sessionId: sessionId,
      gutScore: gut,
      heartScore: heart,
      headScore: head,
      dominantCenter: dominant,
    });

    /* -----------------------------------------
     6️⃣ Replace eligible centers (safe re-run)
  ------------------------------------------ */
    await this.energyEligibleRepo.delete({ sessionId });

    const records = eligibleCenters.map((ec) => ({
      sessionId,
      energyCenter: ec,
    }));

    await this.energyEligibleRepo.save(records);

    /* -----------------------------------------
     7️⃣ Mark Stage 1 completed
  ------------------------------------------ */
    await this.sessionRepo.update(sessionId, {
      stage1CompletedAt: new Date(),
    });

    return {
      gut,
      heart,
      head,
      dominant,
      eligibleCenters,
    };
  } // End finishStage1

  // -------------Retrieve Stage 1 result-------------------

  async getStage1Result(sessionId: string, userId: number) {
    // 1. Validate that the session belongs to the requesting user.
    await this.validateSessionOwnership(sessionId, userId);

    // 2. Retrieve the saved Energy Assessment result.
    const result = await this.energyResultRepo.findOne({
      where: { sessionId },
    });

    // No saved result exists yet.
    if (!result) {
      return null;
    }

    // 3. Retrieve the eligible energy centers.
    const eligibleRecords = await this.energyEligibleRepo.find({
      where: { sessionId },
      order: { id: 'ASC' },
    });

    // 4. Return the saved result without recalculating scores.
    return {
      gut: result.gutScore,
      heart: result.heartScore,
      head: result.headScore,
      dominant: result.dominantCenter,
      eligibleCenters: eligibleRecords.map((record) => record.energyCenter),
    };
  } //getStage1Result

  /*-----------------Unlocked Stage 2 --------------------------
  unlock Stage 2 by setting stage2UnlockedAt timestamp. 
This allows frontend to know when to allow access to Stage 2, 
without needing to check energy results or eligible centers separately. 
*****************************************************************/
  async unlockStage2(sessionId: string, userId: number) {
    const session: TestSession | null = await this.validateSessionOwnership(
      sessionId,
      userId,
    );

    /* -----------------------------------------
     DEV BYPASS CHECK
  ------------------------------------------*/
    const bypass = this.configService.get('DEV_BYPASS_PAYMENT') === 'true';

    if (!bypass) {
      // 🔒 future real payment validation
      throw new HttpException('Payment required', HttpStatus.PAYMENT_REQUIRED);
    }

    /* -----------------------------------------
     UNLOCK STAGE 2
  ------------------------------------------*/
    session.stage2UnlockedAt = new Date();
    await this.sessionRepo.save(session);

    /* -----------------------------------------
     GRANT USER ACCESS
  ------------------------------------------*/
    if (session.userId) {
      await this.userRepo.update(session.userId, {
        accessGranted: true,
      });
    }

    return {
      unlocked: true,
      stage2UnlockedAt: session.stage2UnlockedAt,
    };
  } // End unlockStage2
}
