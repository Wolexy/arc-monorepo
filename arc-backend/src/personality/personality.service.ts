import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, IsNull, Not } from 'typeorm';
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

const ENERGY_CENTERS: readonly EnergyCenter[] = ['GUT', 'HEART', 'HEAD'];

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
     STAGE 2 STATE HELPERS
  ------------------------------------------*/

  // Eligible centers in Stage 1 score order: rows are inserted
  // highest score first, so their id preserves that order.
  private async getEligibleCenters(
    manager: EntityManager,
    testSessionId: string,
  ): Promise<EnergyCenter[]> {
    const rows: EnergyCenterRow[] = await manager.query(
      `
        SELECT energy_center
        FROM energy_result_eligible_centers
        WHERE session_id = $1
        ORDER BY id ASC
      `,
      [testSessionId],
    );

    return rows.map((r) => r.energy_center);
  }

  // Stage 2 is complete once the test session is marked complete or final
  // results exist. Legacy completed sessions have both.
  private async isStage2Completed(
    manager: EntityManager,
    testSessionId: string,
  ): Promise<boolean> {
    const session = await manager
      .getRepository(TestSession)
      .findOne({ where: { id: testSessionId } });

    if (session?.completedAt) return true;

    const finalCount = await manager
      .getRepository(FinalPersonalityResult)
      .count({ where: { testSessionId } });

    return finalCount > 0;
  }

  private async assertStage2NotCompleted(
    manager: EntityManager,
    testSessionId: string,
  ) {
    if (await this.isStage2Completed(manager, testSessionId)) {
      throw new ConflictException('STAGE2_ALREADY_COMPLETED');
    }
  }

  // The requested center must be a real center and eligible for this session.
  private async resolveEligibleCenter(
    manager: EntityManager,
    testSessionId: string,
    energyCenter: string,
  ): Promise<{ center: EnergyCenter; eligible: EnergyCenter[] }> {
    const center = energyCenter as EnergyCenter;

    if (!ENERGY_CENTERS.includes(center)) {
      throw new BadRequestException('INVALID_ENERGY_CENTER');
    }

    const eligible = await this.getEligibleCenters(manager, testSessionId);

    if (!eligible.includes(center)) {
      throw new ForbiddenException('CENTER_NOT_ELIGIBLE');
    }

    return { center, eligible };
  }

  // The first eligible center, in order, that is not yet completed.
  private async getCurrentCenter(
    manager: EntityManager,
    testSessionId: string,
    eligible: EnergyCenter[],
  ): Promise<EnergyCenter | undefined> {
    const sessions = await manager
      .getRepository(PersonalitySession)
      .find({ where: { testSessionId } });

    const completedCenters = sessions
      .filter((s) => s.completedAt)
      .map((s) => s.energyCenter);

    return eligible.find((c) => !completedCenters.includes(c));
  }

  // The lowest question_order question in this center not yet answered.
  private async findNextUnansweredQuestion(
    manager: EntityManager,
    personalitySessionId: number,
    energyCenter: EnergyCenter,
  ): Promise<PersonalityQuestion | undefined> {
    const answered = await manager
      .getRepository(PersonalityResponse)
      .find({ where: { personalitySessionId } });

    const answeredIds = new Set(answered.map((r) => r.questionId));

    const questions = await manager.getRepository(PersonalityQuestion).find({
      where: { energyCenter },
      order: { questionOrder: 'ASC', id: 'ASC' },
    });

    return questions.find((q) => !answeredIds.has(q.id));
  }

  private completedCenterResponse(energyCenter: EnergyCenter) {
    return {
      completed: true,
      stage: 'PERSONALITY',
      energyCenter,
      message: 'Personality assessment completed',
    };
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

    const manager = this.testSessionRepo.manager;

    await this.assertStage2NotCompleted(manager, testSessionId);

    const centers = await this.getEligibleCenters(manager, testSessionId);

    if (!centers.length)
      throw new NotFoundException('No eligible centers found');

    const created: PersonalitySession[] = [];

    for (const center of centers) {
      created.push(
        await this.getOrCreatePersonalitySession(
          testSessionId,
          center,
          manager,
        ),
      );
    }

    return {
      started: true,
      centers: created.map((c) => c.energyCenter),
    };
  }

  /* -----------------------------------------
     GET OR CREATE SESSION
  ------------------------------------------*/
  // ON CONFLICT DO NOTHING lets uq_personality_session resolve concurrent
  // requests: whichever insert lands first wins and both read that row.
  async getOrCreatePersonalitySession(
    testSessionId: string,
    energyCenter: EnergyCenter,
    manager: EntityManager = this.testSessionRepo.manager,
  ): Promise<PersonalitySession> {
    const repo = manager.getRepository(PersonalitySession);

    const existing = await repo.findOne({
      where: { testSessionId, energyCenter },
    });

    if (existing) return existing;

    await repo
      .createQueryBuilder()
      .insert()
      .into(PersonalitySession)
      .values({ testSessionId, energyCenter })
      .orIgnore()
      .execute();

    return repo.findOneOrFail({ where: { testSessionId, energyCenter } });
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

    const manager = this.testSessionRepo.manager;

    const { center, eligible } = await this.resolveEligibleCenter(
      manager,
      testSessionId,
      energyCenter,
    );

    // Read-only once Stage 2 is complete: never create a new center session.
    if (await this.isStage2Completed(manager, testSessionId)) {
      return this.completedCenterResponse(center);
    }

    const existingPs = await this.personalitySessionRepo.findOne({
      where: { testSessionId, energyCenter: center },
    });

    if (existingPs?.completedAt) {
      return this.completedCenterResponse(center);
    }

    const currentCenter = await this.getCurrentCenter(
      manager,
      testSessionId,
      eligible,
    );

    if (currentCenter !== center) {
      throw new ConflictException('CENTER_OUT_OF_SEQUENCE');
    }

    const ps = await this.getOrCreatePersonalitySession(
      testSessionId,
      center,
      manager,
    );

    const question = await this.findNextUnansweredQuestion(
      manager,
      ps.id,
      center,
    );

    if (!question) {
      return this.completedCenterResponse(center);
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

    return this.testSessionRepo.manager.transaction(async (manager) => {
      await this.assertStage2NotCompleted(manager, testSessionId);

      const { center, eligible } = await this.resolveEligibleCenter(
        manager,
        testSessionId,
        energyCenter,
      );

      const psRepo = manager.getRepository(PersonalitySession);

      const existingPs = await psRepo.findOne({
        where: { testSessionId, energyCenter: center },
      });

      if (existingPs?.completedAt) {
        return {
          completed: true,
          message: 'Personality assessment already completed',
        };
      }

      const currentCenter = await this.getCurrentCenter(
        manager,
        testSessionId,
        eligible,
      );

      if (currentCenter !== center) {
        throw new ConflictException('CENTER_OUT_OF_SEQUENCE');
      }

      const { id: psId } = await this.getOrCreatePersonalitySession(
        testSessionId,
        center,
        manager,
      );

      // Serialise answers for this center so the sequence check, the
      // answer count and result calculation see a consistent state.
      const ps = await psRepo.findOne({
        where: { id: psId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!ps) throw new NotFoundException('Personality session not found');

      if (ps.completedAt) {
        return {
          completed: true,
          message: 'Personality assessment already completed',
        };
      }

      const question = await manager
        .getRepository(PersonalityQuestion)
        .findOne({ where: { id: questionId } });

      if (!question) {
        throw new BadRequestException('QUESTION_NOT_FOUND');
      }

      if (question.energyCenter !== center) {
        throw new BadRequestException('QUESTION_CENTER_MISMATCH');
      }

      const rankChoice = await manager
        .getRepository(PersonalityRankChoice)
        .findOne({ where: { id: rankChoiceId } });

      if (!rankChoice) {
        throw new BadRequestException('INVALID_RANK_CHOICE');
      }

      const responseRepo = manager.getRepository(PersonalityResponse);

      const existing = await responseRepo.findOne({
        where: { personalitySessionId: ps.id, questionId },
      });

      if (existing) {
        throw new BadRequestException('Question already answered');
      }

      const nextQuestion = await this.findNextUnansweredQuestion(
        manager,
        ps.id,
        center,
      );

      if (nextQuestion?.id !== question.id) {
        throw new ConflictException('QUESTION_OUT_OF_SEQUENCE');
      }

      await responseRepo.save({
        personalitySessionId: ps.id,
        questionId,
        rankChoiceId,
      });

      const count = await responseRepo.count({
        where: { personalitySessionId: ps.id },
      });
      const totalQuestions = await manager
        .getRepository(PersonalityQuestion)
        .count({ where: { energyCenter: center } });

      if (count >= totalQuestions) {
        await this.calculateResult(ps.id, manager);
        return {
          completed: true,
          message: 'Personality assessment completed',
        };
      }
      return { answered: count };
    });
  }

  /* -----------------------------------------
     CALCULATE RESULT
  ------------------------------------------*/
  // Runs inside the caller's transaction so the breakdown rows and the
  // completion timestamp are written together.
  async calculateResult(
    personalitySessionId: number,
    manager: EntityManager = this.testSessionRepo.manager,
  ) {
    const psRepo = manager.getRepository(PersonalitySession);

    const session = await psRepo.findOne({
      where: { id: personalitySessionId },
    });

    if (!session || session.completedAt) {
      throw new BadRequestException('Session already completed or not found');
    }

    const rows: ScoreRow[] = await manager
      .getRepository(PersonalityResponse)
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

    await manager.getRepository(PersonalityResultBreakdown).save(
      rows.map((r) => ({
        personalitySessionId,
        personalityTypeId: Number(r.personalitytypeid),
        score: Number(r.totalscore),
      })),
    );

    await psRepo.update(personalitySessionId, {
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

    const manager = this.testSessionRepo.manager;

    const eligibleCenters = await this.getEligibleCenters(
      manager,
      testSessionId,
    );

    const nextCenter = await this.getCurrentCenter(
      manager,
      testSessionId,
      eligibleCenters,
    );

    if (!nextCenter) return { completed: true };

    return { completed: false, next: nextCenter };
  }

  /* -----------------------------------------
     FINAL RESULT - legacy debug admin/test only endpoint - can be removed later
  ------------------------------------------*/
  // Final results are written once. A repeated request returns the stored
  // rows unchanged; the test session row lock serialises concurrent calls.
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

    return this.testSessionRepo.manager.transaction(async (manager) => {
      const testSession = await manager.getRepository(TestSession).findOne({
        where: { id: testSessionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!testSession) {
        throw new NotFoundException('Session not found');
      }

      const finalRepo = manager.getRepository(FinalPersonalityResult);

      const stored = await finalRepo.find({
        where: { testSessionId },
        order: { totalScore: 'DESC', personalityTypeId: 'ASC' },
      });

      if (stored.length) {
        return stored.map((r) => ({
          personalityTypeId: r.personalityTypeId,
          totalScore: r.totalScore,
        }));
      }

      // Marked complete but no stored results: never recalculate.
      if (testSession.completedAt) {
        throw new ConflictException('STAGE2_RESULTS_MISSING');
      }

      const sessions = await manager.getRepository(PersonalitySession).find({
        where: {
          testSessionId,
          completedAt: Not(IsNull()),
        },
      });

      if (!sessions.length) {
        throw new NotFoundException('No completed personality assessments');
      }

      const eligibleCenters = await this.getEligibleCenters(
        manager,
        testSessionId,
      );
      const completedCenters = sessions.map((s) => s.energyCenter);

      if (eligibleCenters.some((c) => !completedCenters.includes(c))) {
        throw new ConflictException('STAGE2_NOT_COMPLETE');
      }

      const sessionIds = sessions.map((s) => s.id);

      const rows: ScoreRow[] = await manager
        .getRepository(PersonalityResultBreakdown)
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

      await finalRepo.save(
        results.map((r) => ({
          testSessionId,
          personalityTypeId: r.personalityTypeId,
          totalScore: r.totalScore,
          isDominant: r.totalScore === topScore,
        })),
      );

      // ✅ mark full completion
      await manager.getRepository(TestSession).update(testSessionId, {
        completedAt: new Date(),
      });

      return results;
    });
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
