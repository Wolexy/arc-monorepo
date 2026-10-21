import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestSession } from './entities/test-session.entity';
import { User } from '../users/entities/user.entity';
import { PersonalitySession } from '../personality/entities/personality-session.entity';
import { EnergyResultEligibleCenter } from 'src/energy/entities/energy-result-eligible.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(TestSession)
    private readonly sessionRepo: Repository<TestSession>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(EnergyResultEligibleCenter)
    private energyEligibleRepo: Repository<EnergyResultEligibleCenter>,

    @InjectRepository(PersonalitySession)
    private personalitySessionRepo: Repository<PersonalitySession>,
  ) {}

  async startUserSession(userId: number): Promise<TestSession> {
    /* ------------------------------------------------
  1️⃣ Each user has exactly one session (one_test_per_user).
     Return it whether it is unfinished or completed, so it is
     resumed rather than recreated.
  -------------------------------------------------- */
    const existing = await this.findUserSession(userId);

    if (existing) {
      return existing;
    }

    /* ------------------------------------------------
  2️⃣ Otherwise create the user's session. ON CONFLICT DO NOTHING
     lets one_test_per_user resolve races: a concurrent request that
     inserted first wins and this one reads that row back.
  -------------------------------------------------- */
    await this.sessionRepo
      .createQueryBuilder()
      .insert()
      .into(TestSession)
      .values({ userId, startedAt: new Date() })
      .orIgnore()
      .execute();

    const session = await this.findUserSession(userId);

    if (!session) {
      throw new NotFoundException('Unable to create assessment session');
    }

    return session;
  }

  private findUserSession(userId: number): Promise<TestSession | null> {
    return this.sessionRepo.findOne({
      where: { userId },
      order: { startedAt: 'ASC' },
    });
  }

  /********************************************
getActive Session for a user - returns the user's single session
(unfinished or completed) or null if none. Callers use getProgress to
tell an in-progress session from a completed one.
 ----------------------------------------------*/
  async getActiveSession(userId: number): Promise<TestSession | null> {
    return this.findUserSession(userId);
  }

  async getProgress(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['user'],
    });

    if (!session) {
      return {
        sessionId,
        stage1Completed: false,
        stage1ResultsViewed: false,
        stage2Started: false,
        accessGranted: false,
        eligibleCenters: [],
      };
    }

    // check eligible centers
    let eligibleCenters: string[] = [];
    try {
      const eligible = await this.energyEligibleRepo.find({
        where: { sessionId },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      eligibleCenters = eligible.map((e) => e.energyCenter);
    } catch (err) {
      console.error('eligibleCenters error:', err);
    }

    // check personality session

    let stage2Started = false;

    try {
      const personalitySession = await this.personalitySessionRepo.findOne({
        where: { testSessionId: sessionId },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      stage2Started = !!personalitySession;
    } catch (err) {
      console.error('⚠️ personalitySession error:', err);
    }

    // check user separately
    let accessGranted = false;

    if (session.userId) {
      try {
        const user = await this.userRepo.findOne({
          where: { id: session.userId },
        });

        accessGranted = user?.stage2AccessGranted ?? false;
      } catch (err) {
        console.error('⚠️ user lookup error:', err);
      }
    }
    return {
      sessionId,
      stage1Completed: !!session.stage1CompletedAt,
      stage1ResultsViewed: !!session.stage1ResultsViewedAt,
      stage2Started,
      accessGranted,
      eligibleCenters,
    };
  }

  /********************************************
Record the first time the owner viewed their saved Stage 1 results.
The timestamp comes from the database clock and is never overwritten.
 ----------------------------------------------*/
  async markStage1ResultsViewed(
    sessionId: string,
    userId: number,
    role: string,
  ) {
    const session = await this.validateSessionOwnership(
      sessionId,
      userId,
      role,
    );

    // An admin viewing another user's session must not mark it viewed.
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'Only the session owner can record viewing these results',
      );
    }

    if (!session.stage1CompletedAt) {
      throw new BadRequestException('Stage 1 has not been completed');
    }

    await this.sessionRepo
      .createQueryBuilder()
      .update(TestSession)
      .set({ stage1ResultsViewedAt: () => 'now()' })
      .where('id = :sessionId', { sessionId })
      .andWhere('stage1_results_viewed_at IS NULL')
      .execute();

    const updated = await this.sessionRepo.findOneOrFail({
      where: { id: sessionId },
    });

    return {
      sessionId,
      stage1ResultsViewedAt: updated.stage1ResultsViewedAt,
    };
  }
  //Helper function to validate user's role
  async validateSessionOwnership(
    sessionId: string,
    userId: number,
    role: string,
  ) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (role !== 'ADMIN' && session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    if (!session.userId) {
      throw new ForbiddenException(
        'This session is not associated with a user',
      );
    }

    const owner = await this.userRepo.findOne({
      where: { id: session.userId },
    });

    if (!owner) {
      throw new NotFoundException('Session owner not found');
    }

    if (!owner.accountEnabled) {
      throw new ForbiddenException('The session owner account is disabled');
    }

    if (!owner.emailVerified) {
      throw new ForbiddenException('The session owner email is not verified');
    }

    return session;
  }
}
