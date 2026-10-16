import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { TestSession } from '../sessions/entities/test-session.entity';
import { PersonalitySession } from './entities/personality-session.entity';
import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityRankChoice } from './entities/personality-rank-choice.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityResultBreakdown } from './entities/personality-result-breakdown.entity';
import { FinalPersonalityResult } from './entities/final-personality-result.entity';
import { User } from '../users/entities/user.entity';
import { PersonalityTypeDescription } from './entities/personality-type-description.entity';
import { PersonalityType } from './entities/personality-type.entity';
import { FinalReportDto } from './dto/final-report.dto';
import { DominantTypeReportDto } from './dto/dominant-type-report.dto';
import { RunnerUpTypeReportDto } from './dto/runner-up-type-report.dto';

type EnergyCenter = 'GUT' | 'HEART' | 'HEAD';

interface EnergyCenterRow {
  energy_center: EnergyCenter;
}

interface ScoreRow {
  personalitytypeid: string;
  totalscore: string;
}

@Injectable()
export class PersonalityService {
  constructor(
    @InjectRepository(TestSession)
    private readonly testSessionRepo: Repository<TestSession>,

    @InjectRepository(PersonalitySession)
    private readonly personalitySessionRepo: Repository<PersonalitySession>,

    @InjectRepository(PersonalityQuestion)
    private readonly questionRepo: Repository<PersonalityQuestion>,

    @InjectRepository(PersonalityRankChoice)
    private readonly rankRepo: Repository<PersonalityRankChoice>,

    @InjectRepository(PersonalityResponse)
    private readonly responseRepo: Repository<PersonalityResponse>,

    @InjectRepository(PersonalityResultBreakdown)
    private readonly breakdownRepo: Repository<PersonalityResultBreakdown>,

    @InjectRepository(FinalPersonalityResult)
    private readonly finalResultRepo: Repository<FinalPersonalityResult>,

    @InjectRepository(PersonalityType)
    private readonly personalityTypeRepo: Repository<PersonalityType>,

    @InjectRepository(PersonalityTypeDescription)
    private readonly personalityTypeDescriptionRepo: Repository<PersonalityTypeDescription>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* -----------------------------------------
     ACCESS GATE
  ------------------------------------------*/

  async canAccessStage2(
    testSessionId: string,
    requesterId: number,
    requesterRole: string,
  ) {
    const session = await this.testSessionRepo.findOne({
      where: { id: testSessionId },
    });

    if (!session) {
      return {
        allowed: false,
        reason: 'SESSION_NOT_FOUND',
      };
    }

    if (requesterRole !== 'ADMIN' && session.userId !== requesterId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    if (!session.stage1CompletedAt) {
      return {
        allowed: false,
        reason: 'STAGE1_NOT_COMPLETED',
      };
    }

    if (!session.userId) {
      return {
        allowed: false,
        reason: 'SESSION_HAS_NO_USER',
      };
    }

    const owner = await this.userRepo.findOne({
      where: { id: session.userId },
    });

    if (!owner) {
      return {
        allowed: false,
        reason: 'USER_NOT_FOUND',
      };
    }

    if (!owner.accountEnabled) {
      return {
        allowed: false,
        reason: 'ACCOUNT_DISABLED',
      };
    }

    if (!owner.emailVerified) {
      return {
        allowed: false,
        reason: 'EMAIL_NOT_VERIFIED',
      };
    }

    if (requesterRole !== 'ADMIN' && !owner.stage2AccessGranted) {
      return {
        allowed: false,
        reason: 'AUTH_REQUIRED',
      };
    }

    return { allowed: true };
  }

  /* -----------------------------------------
     START PERSONALITY
  ------------------------------------------*/
  async startPersonality(
    testSessionId: string,
    requesterId: number,
    requesterRole: string,
  ) {
    const session = await this.testSessionRepo.findOne({
      where: { id: testSessionId },
    });

    if (!session) throw new UnauthorizedException('Session not found');
    if (!session.stage1CompletedAt)
      throw new UnauthorizedException('STAGE1_NOT_COMPLETED');

    const access = await this.canAccessStage2(
      testSessionId,
      requesterId,
      requesterRole,
    );

    if (!access.allowed) throw new UnauthorizedException(access.reason);

    const rows: EnergyCenterRow[] = await this.testSessionRepo.manager.query(
      `
        SELECT energy_center
        FROM energy_result_eligible_centers
        WHERE session_id = $1
      `,
      [testSessionId],
    );

    if (!rows.length) throw new NotFoundException('No eligible centers found');

    const created: PersonalitySession[] = [];

    for (const row of rows) {
      const center = row.energy_center;

      let ps = await this.personalitySessionRepo.findOne({
        where: { testSessionId, energyCenter: center },
      });

      if (!ps) {
        ps = await this.personalitySessionRepo.save({
          testSessionId,
          energyCenter: center,
        });
      }
      created.push(ps);
    }

    return {
      started: true,
      centers: created.map((c) => c.energyCenter),
    };
  }

  /* -----------------------------------------
     GET OR CREATE SESSION
  ------------------------------------------*/
  async getOrCreatePersonalitySession(
    testSessionId: string,
    energyCenter: EnergyCenter,
  ): Promise<PersonalitySession> {
    let ps = await this.personalitySessionRepo.findOne({
      where: { testSessionId, energyCenter },
    });

    if (!ps) {
      ps = await this.personalitySessionRepo.save({
        testSessionId,
        energyCenter,
      });
    }
    return ps;
  }

  /* -----------------------------------------
     GET NEXT QUESTION
  ------------------------------------------*/
  async getNextQuestion(
    testSessionId: string,
    energyCenter: EnergyCenter,
    requesterId: number,
    requesterRole: string,
  ) {
    // Validate session ownership and Stage 2 access first.
    const access = await this.canAccessStage2(
      testSessionId,
      requesterId,
      requesterRole,
    );

    if (!access.allowed) {
      throw new ForbiddenException(access.reason);
    }

    const ps = await this.getOrCreatePersonalitySession(
      testSessionId,
      energyCenter,
    );

    const answered = await this.responseRepo.find({
      where: { personalitySessionId: ps.id },
    });

    const answeredIds = answered.map((r) => r.questionId);

    const qb = this.questionRepo
      .createQueryBuilder('q')
      .where('q.energy_center = :center', { center: energyCenter })
      .orderBy('q.question_order', 'ASC');

    if (answeredIds.length) {
      qb.andWhere('q.id NOT IN (:...ids)', { ids: answeredIds });
    }

    const question = await qb.getOne();

    if (!question) {
      return {
        completed: true,
        stage: 'PERSONALITY',
        energyCenter,
        message: 'Personality assessment completed',
      };
    }

    const options = await this.rankRepo.find({
      order: { score: 'ASC' },
    });
    return { question, options };
  }

  /* -----------------------------------------
     SUBMIT ANSWER
  ------------------------------------------*/
  async submitAnswer(
    testSessionId: string,
    energyCenter: EnergyCenter,
    questionId: number,
    rankChoiceId: number,
    requesterId: number,
    requesterRole: string,
  ) {
    const access = await this.canAccessStage2(
      testSessionId,
      requesterId,
      requesterRole,
    );

    if (!access.allowed) {
      throw new ForbiddenException(access.reason);
    }

    const ps = await this.getOrCreatePersonalitySession(
      testSessionId,
      energyCenter,
    );

    if (ps.completedAt) {
      return {
        completed: true,
        message: 'Personality assessment already completed',
      };
    }

    const existing = await this.responseRepo.findOne({
      where: { personalitySessionId: ps.id, questionId },
    });

    if (existing) {
      throw new BadRequestException('Question already answered');
    }

    await this.responseRepo.save({
      personalitySessionId: ps.id,
      questionId,
      rankChoiceId,
    });

    const count = await this.responseRepo.count({
      where: { personalitySessionId: ps.id },
    });
    const totalQuestions = await this.questionRepo.count({
      where: {
        energyCenter,
      },
    });
    if (count >= totalQuestions) {
      await this.calculateResult(ps.id);
      return {
        completed: true,
        message: 'Personality assessment completed',
      };
    }
    return { answered: count };
  }

  /* -----------------------------------------
     CALCULATE RESULT
  ------------------------------------------*/
  async calculateResult(personalitySessionId: number) {
    const session = await this.personalitySessionRepo.findOne({
      where: { id: personalitySessionId },
    });

    if (!session || session.completedAt) {
      throw new BadRequestException('Session already completed or not found');
    }

    const rows: ScoreRow[] = await this.responseRepo
      .createQueryBuilder('r')
      .innerJoin('personality_rank_choices', 'rc', 'rc.id = r.rank_choice_id')
      .innerJoin('personality_questions', 'q', 'q.id = r.question_id')
      .select([
        'q.personality_type_id AS personalitytypeid',
        'SUM(rc.score) AS totalscore',
      ])
      .where('r.personality_session_id = :id', {
        id: personalitySessionId,
      })
      .groupBy('q.personality_type_id')
      .orderBy('totalscore', 'DESC')
      .getRawMany();

    if (!rows.length) throw new BadRequestException('No responses found');

    await this.breakdownRepo.save(
      rows.map((r) => ({
        personalitySessionId,
        personalityTypeId: Number(r.personalitytypeid),
        score: Number(r.totalscore),
      })),
    );

    await this.personalitySessionRepo.update(personalitySessionId, {
      completedAt: new Date(),
    });

    const topScore = Number(rows[0].totalscore);

    const dominant = rows
      .filter((r) => Number(r.totalscore) === topScore)
      .slice(0, 2)
      .map((r) => Number(r.personalitytypeid));

    return {
      dominantPersonalityTypeIds: dominant,
    };
  }

  /* -----------------------------------------
     NEXT ENERGY CENTER
  ------------------------------------------*/
  async getNextEnergyCenter(
    testSessionId: string,
    requesterId: number,
    requesterRole: string,
  ) {
      const access = await this.canAccessStage2(
        testSessionId,
        requesterId,
        requesterRole,
      );

      if (!access.allowed) {
        throw new ForbiddenException(access.reason);
      }
    const rows: EnergyCenterRow[] = await this.testSessionRepo.manager.query(
      `
        SELECT energy_center
        FROM energy_result_eligible_centers
        WHERE session_id = $1
      `,
      [testSessionId],
    );

    const eligibleCenters = rows.map((r) => r.energy_center);

    const sessions = await this.personalitySessionRepo.find({
      where: { testSessionId },
    });

    const completedCenters = sessions
      .filter((s) => s.completedAt)
      .map((s) => s.energyCenter);

    const nextCenter = eligibleCenters.find(
      (c) => !completedCenters.includes(c),
    );

    if (!nextCenter) return { completed: true };

    return { completed: false, next: nextCenter };
  }

  /* -----------------------------------------
     FINAL RESULT - legacy debug admin/test only endpoint - can be removed later
  ------------------------------------------*/
  async aggregateFinalPersonality(testSessionId: string,
    requesterId: number,
    requesterRole: string
  ) {
    const access = await this.canAccessStage2(
      testSessionId,
      requesterId,
      requesterRole,
    );

    if (!access.allowed) {
      throw new ForbiddenException(access.reason);
    }
    const sessions = await this.personalitySessionRepo.find({
      where: {
        testSessionId,
        completedAt: Not(IsNull()),
      },
    });

    if (!sessions.length) {
      throw new NotFoundException('No completed personality assessments');
    }

    const sessionIds = sessions.map((s) => s.id);

    const rows: ScoreRow[] = await this.breakdownRepo
      .createQueryBuilder('b')
      .select([
        'b.personality_type_id AS personalitytypeid',
        'SUM(b.score) AS totalscore',
      ])
      .where('b.personality_session_id IN (:...ids)', {
        ids: sessionIds,
      })
      .groupBy('b.personality_type_id')
      .orderBy('totalscore', 'DESC')
      .getRawMany();

    const results = rows.map((r) => ({
      personalityTypeId: Number(r.personalitytypeid),
      totalScore: Number(r.totalscore),
    }));

    const topScore = Math.max(...results.map((r) => r.totalScore));

    await this.finalResultRepo.delete({ testSessionId });

    await this.finalResultRepo.save(
      results.map((r) => ({
        testSessionId,
        personalityTypeId: r.personalityTypeId,
        totalScore: r.totalScore,
        isDominant: r.totalScore === topScore,
      })),
    );

    // ✅ mark full completion
    await this.testSessionRepo.update(testSessionId, {
      completedAt: new Date(),
    });

    return results;
  }

  /***********************
Final Report Generation and Retrieval
 ***********************/
  async getFinalReport(
    testSessionId: string,
    userId: number,
    role: string,
  ): Promise<FinalReportDto> {
    await this.validateOwnership(testSessionId, userId, role);

    const results = await this.finalResultRepo.find({
      where: { testSessionId },
      order: {
        totalScore: 'DESC',
      },
    });

    if (!results.length) {
      throw new NotFoundException('No final results found');
    }
    const topScore = results[0].totalScore;
    const dominantResults = results.filter((r) => r.totalScore === topScore);
    const runnerUpResult = results.find((r) => r.totalScore < topScore);

    const confidence = this.calculateConfidence(
      dominantResults.length,
      topScore,
      runnerUpResult?.totalScore ?? topScore,
    );

    const dominantTypes: DominantTypeReportDto[] = [];
    let runnerUp: RunnerUpTypeReportDto | null = null;

    //runner up results
    if (runnerUpResult) {
      const type = await this.personalityTypeRepo.findOneBy({
        id: runnerUpResult.personalityTypeId,
      });

      const description = await this.personalityTypeDescriptionRepo.findOneBy({
        personalityTypeId: runnerUpResult.personalityTypeId,
      });

      runnerUp = {
        personalityTypeId: runnerUpResult.personalityTypeId,
        code: type?.code,
        name: type?.name,
        title: description?.title,
        score: runnerUpResult.totalScore,
      };
    }

    //Dominant results
    for (const result of dominantResults) {
      const type = await this.personalityTypeRepo.findOne({
        where: {
          id: result.personalityTypeId,
        },
      });

      const description = await this.personalityTypeDescriptionRepo.findOne({
        where: {
          personalityTypeId: result.personalityTypeId,
        },
      });
      const dto: DominantTypeReportDto = {
        personalityTypeId: result.personalityTypeId,
        code: type?.code,
        name: type?.name,
        title: description?.title,
        score: result.totalScore,
        overview: description?.overview ?? '',
        strengths: description?.strengths ?? '',
        weaknesses: description?.weaknesses ?? '',
        growthPath: description?.growthPath ?? '',
      };

      dominantTypes.push(dto);
    }
    return {
      sessionId: testSessionId,
      dominantTypes,
      runnerUp,
      confidence,
    };
  }

  //Calculate confidence level based on score gap and number of dominant types
  private calculateConfidence(
    dominantCount: number,
    topScore: number,
    runnerUpScore: number,
  ) {
    // tie for first place
    if (dominantCount > 1) {
      return {
        score: 0,
        level: 'LOW',
        reason: 'MULTIPLE_DOMINANT_TYPES',
      };
    }

    const gap = topScore - runnerUpScore;
    let level = 'LOW';

    if (gap > 5) {
      level = 'HIGH';
    } else if (gap > 0) {
      level = 'MEDIUM';
    }
    return {
      score: gap,
      level,
    };
  }
  //Helper method to validate session ownership and access rights
  private async validateOwnership(
    sessionId: string,
    userId: number,
    role: string,
  ) {
    const session = await this.testSessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (role === 'ADMIN') {
      return session;
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }
    return session;
  }
}
