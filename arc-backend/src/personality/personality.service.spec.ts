import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';

import { PersonalityService } from './personality.service';
import { TestSession } from '../sessions/entities/test-session.entity';
import { PersonalitySession } from './entities/personality-session.entity';
import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityRankChoice } from './entities/personality-rank-choice.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityResultBreakdown } from './entities/personality-result-breakdown.entity';
import { FinalPersonalityResult } from './entities/final-personality-result.entity';
import { PersonalityType } from './entities/personality-type.entity';
import { PersonalityTypeDescription } from './entities/personality-type-description.entity';
import { User } from '../users/entities/user.entity';

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access --
   The fake repositories below mirror TypeORM's async, loosely typed API. */

/* ------------------------------------------------------------------
   In-memory stand-in for the TypeORM repositories the service uses.
   It enforces the same unique keys as the live schema so duplicate
   writes fail the way PostgreSQL would. Row locks are not simulated.
------------------------------------------------------------------- */

type Row = Record<string, any>;
type EntityClass = abstract new (...args: any[]) => any;

const UNIQUE_KEYS = new Map<EntityClass, string[]>([
  [PersonalitySession, ['testSessionId', 'energyCenter']],
  [PersonalityResponse, ['personalitySessionId', 'questionId']],
  [PersonalityResultBreakdown, ['personalitySessionId', 'personalityTypeId']],
  [FinalPersonalityResult, ['testSessionId', 'personalityTypeId']],
]);

class FakeDb {
  private tables = new Map<EntityClass, Row[]>();
  private nextIds = new Map<EntityClass, number>();
  eligible: { id: number; session_id: string; energy_center: string }[] = [];

  table(entity: EntityClass): Row[] {
    if (!this.tables.has(entity)) this.tables.set(entity, []);
    return this.tables.get(entity)!;
  }

  insert(entity: EntityClass, input: Row): Row {
    const rows = this.table(entity);
    const key = UNIQUE_KEYS.get(entity);

    if (key && rows.some((r) => key.every((k) => r[k] === input[k]))) {
      throw Object.assign(new Error('duplicate key value'), { code: '23505' });
    }

    const row = { ...input };
    if (row.id === undefined) {
      const next = (this.nextIds.get(entity) ?? 1000) + 1;
      this.nextIds.set(entity, next);
      row.id = next;
    }
    rows.push(row);
    return { ...row };
  }

  // Everything a test needs to prove saved Stage 2 data did not change.
  snapshot(testSessionId: string) {
    const ps = this.table(PersonalitySession).filter(
      (p) => p.testSessionId === testSessionId,
    );
    const psIds = ps.map((p) => p.id);

    return structuredClone({
      testSession: this.table(TestSession).find((s) => s.id === testSessionId),
      personalitySessions: ps,
      responses: this.table(PersonalityResponse).filter((r) =>
        psIds.includes(r.personalitySessionId),
      ),
      breakdowns: this.table(PersonalityResultBreakdown).filter((b) =>
        psIds.includes(b.personalitySessionId),
      ),
      finals: this.table(FinalPersonalityResult).filter(
        (f) => f.testSessionId === testSessionId,
      ),
    });
  }
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value instanceof FindOperator) {
      if (value.type === 'isNull') return row[key] == null;
      if (value.type === 'not' && value.child?.type === 'isNull') {
        return row[key] != null;
      }
      throw new Error(`Unsupported operator ${value.type}`);
    }
    return row[key] === value;
  });
}

class FakeQueryBuilder {
  private params: Row = {};
  private target?: EntityClass;
  private insertValues?: Row;
  private ignore = false;

  constructor(
    private readonly db: FakeDb,
    private readonly entity: EntityClass,
  ) {}

  insert() {
    return this;
  }
  into(entity: EntityClass) {
    this.target = entity;
    return this;
  }
  orIgnore() {
    this.ignore = true;
    return this;
  }
  innerJoin() {
    return this;
  }
  select() {
    return this;
  }
  groupBy() {
    return this;
  }
  orderBy() {
    return this;
  }
  where(_sql: string, params: Row = {}) {
    Object.assign(this.params, params);
    return this;
  }

  values(v: Row) {
    this.insertValues = v;
    return this;
  }

  async execute() {
    try {
      this.db.insert(this.target!, this.insertValues!);
    } catch (err) {
      if (!(this.ignore && (err as { code?: string }).code === '23505')) {
        throw err;
      }
    }
    return {};
  }

  async getRawMany() {
    const totals = new Map<number, number>();

    if (this.entity === PersonalityResponse) {
      const questions = this.db.table(PersonalityQuestion);
      const choices = this.db.table(PersonalityRankChoice);

      for (const r of this.db.table(PersonalityResponse)) {
        if (r.personalitySessionId !== this.params.id) continue;
        const q = questions.find((x) => x.id === r.questionId)!;
        const c = choices.find((x) => x.id === r.rankChoiceId)!;
        totals.set(
          q.personalityTypeId,
          (totals.get(q.personalityTypeId) ?? 0) + c.score,
        );
      }
    } else if (this.entity === PersonalityResultBreakdown) {
      for (const b of this.db.table(PersonalityResultBreakdown)) {
        if (!this.params.ids.includes(b.personalitySessionId)) continue;
        totals.set(
          b.personalityTypeId,
          (totals.get(b.personalityTypeId) ?? 0) + b.score,
        );
      }
    } else {
      throw new Error('Unexpected aggregate query');
    }

    // PostgreSQL returns raw aggregates as strings.
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, score]) => ({
        personalitytypeid: String(type),
        totalscore: String(score),
      }));
  }
}

class FakeRepo {
  constructor(
    private readonly db: FakeDb,
    private readonly entity: EntityClass,
    public readonly manager: FakeManager,
  ) {}

  private rows() {
    return this.db.table(this.entity);
  }

  async findOne(opts: { where: Row }) {
    const row = this.rows().find((r) => matches(r, opts.where));
    return row ? { ...row } : null;
  }

  async findOneOrFail(opts: { where: Row }) {
    const row = await this.findOne(opts);
    if (!row) throw new Error('EntityNotFound');
    return row;
  }

  async findOneBy(where: Row) {
    return this.findOne({ where });
  }

  async find(
    opts: { where?: Row; order?: Record<string, 'ASC' | 'DESC'> } = {},
  ) {
    const rows = this.rows()
      .filter((r) => matches(r, opts.where))
      .map((r) => ({ ...r }));

    const order = Object.entries(opts.order ?? {});
    return rows.sort((a, b) => {
      for (const [key, dir] of order) {
        if (a[key] !== b[key]) {
          return (a[key] < b[key] ? -1 : 1) * (dir === 'ASC' ? 1 : -1);
        }
      }
      return 0;
    });
  }

  async count(opts: { where?: Row } = {}) {
    return this.rows().filter((r) => matches(r, opts.where)).length;
  }

  async save(input: Row | Row[]) {
    if (Array.isArray(input)) {
      return input.map((r) => this.db.insert(this.entity, r));
    }
    return this.db.insert(this.entity, input);
  }

  async update(id: unknown, patch: Row) {
    const row = this.rows().find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return {};
  }

  createQueryBuilder() {
    return new FakeQueryBuilder(this.db, this.entity);
  }
}

class FakeManager {
  private repos = new Map<EntityClass, FakeRepo>();
  lastEligibleSql = '';

  constructor(private readonly db: FakeDb) {}

  getRepository(entity: EntityClass) {
    if (!this.repos.has(entity)) {
      this.repos.set(entity, new FakeRepo(this.db, entity, this));
    }
    return this.repos.get(entity)!;
  }

  // Only the eligible-centers query is raw SQL. Without an explicit
  // ORDER BY the fake returns rows in reverse, like an unordered scan might.
  async query(sql: string, params: unknown[]) {
    if (!sql.includes('energy_result_eligible_centers')) {
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    this.lastEligibleSql = sql;

    const rows = this.db.eligible
      .filter((r) => r.session_id === params[0])
      .sort((a, b) => a.id - b.id);

    const ordered = /ORDER BY id ASC/i.test(sql) ? rows : rows.reverse();
    return ordered.map((r) => ({ energy_center: r.energy_center }));
  }

  async transaction<T>(work: (manager: FakeManager) => Promise<T>) {
    return work(this);
  }
}

/* ------------------------------------------------------------------
   Fixture
------------------------------------------------------------------- */

const OWNER = 10;
const NO_GRANT_OWNER = 11;
const LEGACY_OWNER = 12;
const ADMIN = 1;

const ACTIVE = 'ts-active'; // eligible: HEAD (id 5) then GUT (id 6)
const NO_GRANT = 'ts-no-grant';
const LEGACY = 'ts-legacy'; // completed through the legacy workflow

function seed(db: FakeDb) {
  const user = (id: number, extra: Row = {}) => ({
    id,
    role: 'USER',
    accountEnabled: true,
    emailVerified: true,
    stage2AccessGranted: true,
    ...extra,
  });

  db.table(User).push(
    user(ADMIN, { role: 'ADMIN' }),
    user(OWNER),
    user(NO_GRANT_OWNER, { stage2AccessGranted: false }),
    user(LEGACY_OWNER),
  );

  const stage1Done = new Date('2026-01-01T10:00:00Z');
  db.table(TestSession).push(
    {
      id: ACTIVE,
      userId: OWNER,
      stage1CompletedAt: stage1Done,
      completedAt: null,
    },
    {
      id: NO_GRANT,
      userId: NO_GRANT_OWNER,
      stage1CompletedAt: stage1Done,
      completedAt: null,
    },
    {
      id: LEGACY,
      userId: LEGACY_OWNER,
      stage1CompletedAt: stage1Done,
      completedAt: new Date('2026-01-02T10:00:00Z'),
    },
  );

  db.eligible.push(
    { id: 3, session_id: LEGACY, energy_center: 'GUT' },
    { id: 5, session_id: ACTIVE, energy_center: 'HEAD' },
    { id: 6, session_id: ACTIVE, energy_center: 'GUT' },
    { id: 7, session_id: NO_GRANT, energy_center: 'GUT' },
  );

  // Three questions per center, stored out of question_order on purpose.
  const q = (
    id: number,
    energyCenter: string,
    questionOrder: number,
    personalityTypeId: number,
  ) => ({
    id,
    energyCenter,
    questionOrder,
    personalityTypeId,
    text: `Q${id}`,
  });
  db.table(PersonalityQuestion).push(
    q(101, 'GUT', 2, 8),
    q(102, 'GUT', 1, 1),
    q(103, 'GUT', 3, 9),
    q(201, 'HEAD', 3, 7),
    q(202, 'HEAD', 1, 5),
    q(203, 'HEAD', 2, 6),
    q(301, 'HEART', 1, 2),
    q(302, 'HEART', 2, 3),
    q(303, 'HEART', 3, 4),
  );

  db.table(PersonalityRankChoice).push(
    ...['TOTALLY FALSE', 'NOT TRUE', 'INDIFFERENT', 'TRUE', 'VERY TRUE'].map(
      (label, i) => ({ id: i + 1, label, score: i + 1 }),
    ),
  );

  // Legacy completed attempt: completed GUT session, its answers,
  // breakdowns and final results, all already persisted.
  db.table(PersonalitySession).push({
    id: 50,
    testSessionId: LEGACY,
    energyCenter: 'GUT',
    completedAt: new Date('2026-01-01T12:00:00Z'),
  });
  db.table(PersonalityResponse).push(
    { id: 501, personalitySessionId: 50, questionId: 102, rankChoiceId: 5 },
    { id: 502, personalitySessionId: 50, questionId: 101, rankChoiceId: 4 },
    { id: 503, personalitySessionId: 50, questionId: 103, rankChoiceId: 2 },
  );
  db.table(PersonalityResultBreakdown).push(
    { id: 601, personalitySessionId: 50, personalityTypeId: 1, score: 5 },
    { id: 602, personalitySessionId: 50, personalityTypeId: 8, score: 4 },
    { id: 603, personalitySessionId: 50, personalityTypeId: 9, score: 2 },
  );
  db.table(FinalPersonalityResult).push(
    {
      id: 701,
      testSessionId: LEGACY,
      personalityTypeId: 1,
      totalScore: 5,
      isDominant: true,
    },
    {
      id: 702,
      testSessionId: LEGACY,
      personalityTypeId: 8,
      totalScore: 4,
      isDominant: false,
    },
    {
      id: 703,
      testSessionId: LEGACY,
      personalityTypeId: 9,
      totalScore: 2,
      isDominant: false,
    },
  );
}

/* ------------------------------------------------------------------
   Tests
------------------------------------------------------------------- */

describe('PersonalityService Stage 2 hardening', () => {
  let db: FakeDb;
  let manager: FakeManager;
  let service: PersonalityService;

  const answerAll = async (
    testSessionId: string,
    center: string,
    userId = OWNER,
  ) => {
    for (;;) {
      const next = await service.getNextQuestion(
        testSessionId,
        center as never,
        userId,
        'USER',
      );
      if ('completed' in next) return;
      await service.submitAnswer(
        testSessionId,
        center as never,
        next.question.id,
        4,
        userId,
        'USER',
      );
    }
  };

  const responsesFor = (testSessionId: string) =>
    db.snapshot(testSessionId).responses;

  beforeEach(async () => {
    db = new FakeDb();
    manager = new FakeManager(db);
    seed(db);

    const entities = [
      TestSession,
      PersonalitySession,
      PersonalityQuestion,
      PersonalityRankChoice,
      PersonalityResponse,
      PersonalityResultBreakdown,
      FinalPersonalityResult,
      PersonalityType,
      PersonalityTypeDescription,
      User,
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalityService,
        ...entities.map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: manager.getRepository(entity),
        })),
      ],
    }).compile();

    service = module.get(PersonalityService);
  });

  describe('final-result immutability', () => {
    it('returns the stored results for a legacy completed session without rewriting them', async () => {
      const before = db.snapshot(LEGACY);

      const results = await service.aggregateFinalPersonality(
        LEGACY,
        LEGACY_OWNER,
        'USER',
      );

      expect(results).toEqual([
        { personalityTypeId: 1, totalScore: 5 },
        { personalityTypeId: 8, totalScore: 4 },
        { personalityTypeId: 9, totalScore: 2 },
      ]);
      expect(db.snapshot(LEGACY)).toEqual(before);
    });

    it('calculates once, then returns the same stored results on repeat without overwriting', async () => {
      await answerAll(ACTIVE, 'HEAD');
      await answerAll(ACTIVE, 'GUT');

      const first = await service.aggregateFinalPersonality(
        ACTIVE,
        OWNER,
        'USER',
      );
      const afterFirst = db.snapshot(ACTIVE);

      expect(afterFirst.finals).toHaveLength(6);
      expect(afterFirst.testSession!.completedAt).not.toBeNull();

      const second = await service.aggregateFinalPersonality(
        ACTIVE,
        OWNER,
        'USER',
      );

      expect(second).toEqual(
        [...first].sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            a.personalityTypeId - b.personalityTypeId,
        ),
      );
      expect(db.snapshot(ACTIVE)).toEqual(afterFirst);
    });

    it('refuses to finalise before every eligible center is complete', async () => {
      await answerAll(ACTIVE, 'HEAD');

      await expect(
        service.aggregateFinalPersonality(ACTIVE, OWNER, 'USER'),
      ).rejects.toThrow(new ConflictException('STAGE2_NOT_COMPLETE'));
      expect(db.snapshot(ACTIVE).finals).toHaveLength(0);
    });

    it('never recalculates a session marked complete whose results are missing', async () => {
      db.table(TestSession).find((s) => s.id === ACTIVE)!.completedAt =
        new Date();

      await expect(
        service.aggregateFinalPersonality(ACTIVE, OWNER, 'USER'),
      ).rejects.toThrow(new ConflictException('STAGE2_RESULTS_MISSING'));
      expect(db.snapshot(ACTIVE).finals).toHaveLength(0);
    });
  });

  describe('operations after completion', () => {
    it('returns 409 when starting another attempt on a legacy completed session', async () => {
      const before = db.snapshot(LEGACY);

      await expect(
        service.startPersonality(LEGACY, LEGACY_OWNER, 'USER'),
      ).rejects.toThrow(new ConflictException('STAGE2_ALREADY_COMPLETED'));
      expect(db.snapshot(LEGACY)).toEqual(before);
    });

    it('returns 409 when submitting an answer to a legacy completed session', async () => {
      const before = db.snapshot(LEGACY);

      await expect(
        service.submitAnswer(LEGACY, 'GUT', 102, 1, LEGACY_OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.snapshot(LEGACY)).toEqual(before);
    });

    it('returns 409 for start and answer once a new attempt has been finalised', async () => {
      await answerAll(ACTIVE, 'HEAD');
      await answerAll(ACTIVE, 'GUT');
      await service.aggregateFinalPersonality(ACTIVE, OWNER, 'USER');
      const before = db.snapshot(ACTIVE);

      await expect(
        service.startPersonality(ACTIVE, OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 202, 1, OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.snapshot(ACTIVE)).toEqual(before);
    });

    it('treats final results alone as completion, even without completedAt', async () => {
      db.table(TestSession).find((s) => s.id === LEGACY)!.completedAt = null;

      await expect(
        service.startPersonality(LEGACY, LEGACY_OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('serves a legacy completed center read-only without creating sessions', async () => {
      const before = db.snapshot(LEGACY);

      await expect(
        service.getNextQuestion(LEGACY, 'GUT', LEGACY_OWNER, 'USER'),
      ).resolves.toEqual(
        expect.objectContaining({ completed: true, energyCenter: 'GUT' }),
      );
      await expect(
        service.getNextEnergyCenter(LEGACY, LEGACY_OWNER, 'USER'),
      ).resolves.toEqual({
        completed: true,
      });
      expect(db.snapshot(LEGACY)).toEqual(before);
    });
  });

  describe('eligible-center validation', () => {
    it('rejects a center that is not eligible for the session', async () => {
      await expect(
        service.getNextQuestion(ACTIVE, 'HEART', OWNER, 'USER'),
      ).rejects.toThrow(new ForbiddenException('CENTER_NOT_ELIGIBLE'));
      await expect(
        service.submitAnswer(ACTIVE, 'HEART', 301, 3, OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(0);
    });

    it('rejects an unknown center name', async () => {
      await expect(
        service.getNextQuestion(ACTIVE, 'FOO' as never, OWNER, 'USER'),
      ).rejects.toThrow(new BadRequestException('INVALID_ENERGY_CENTER'));
      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(0);
    });

    it('rejects skipping ahead to a later eligible center', async () => {
      await expect(
        service.getNextQuestion(ACTIVE, 'GUT', OWNER, 'USER'),
      ).rejects.toThrow(new ConflictException('CENTER_OUT_OF_SEQUENCE'));
      await expect(
        service.submitAnswer(ACTIVE, 'GUT', 102, 3, OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(responsesFor(ACTIVE)).toHaveLength(0);
    });

    it('moves to the next center in Stage 1 score order once the first is done', async () => {
      await expect(
        service.getNextEnergyCenter(ACTIVE, OWNER, 'USER'),
      ).resolves.toEqual({
        completed: false,
        next: 'HEAD',
      });

      await answerAll(ACTIVE, 'HEAD');

      await expect(
        service.getNextEnergyCenter(ACTIVE, OWNER, 'USER'),
      ).resolves.toEqual({
        completed: false,
        next: 'GUT',
      });
      expect(manager.lastEligibleSql).toMatch(/ORDER BY id ASC/);
    });
  });

  describe('question validation', () => {
    it('rejects a question from another center without saving anything', async () => {
      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 102, 3, OWNER, 'USER'),
      ).rejects.toThrow(new BadRequestException('QUESTION_CENTER_MISMATCH'));
      expect(responsesFor(ACTIVE)).toHaveLength(0);
    });

    it('rejects unknown questions, unknown rank choices and out-of-order questions', async () => {
      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 999, 3, OWNER, 'USER'),
      ).rejects.toThrow(new BadRequestException('QUESTION_NOT_FOUND'));

      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 202, 9, OWNER, 'USER'),
      ).rejects.toThrow(new BadRequestException('INVALID_RANK_CHOICE'));

      // 203 is question_order 2; 202 (order 1) must be answered first.
      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 203, 3, OWNER, 'USER'),
      ).rejects.toThrow(new ConflictException('QUESTION_OUT_OF_SEQUENCE'));

      expect(responsesFor(ACTIVE)).toHaveLength(0);
    });

    it('keeps the original answer when the same question is submitted again', async () => {
      await service.submitAnswer(ACTIVE, 'HEAD', 202, 5, OWNER, 'USER');

      await expect(
        service.submitAnswer(ACTIVE, 'HEAD', 202, 1, OWNER, 'USER'),
      ).rejects.toThrow(new BadRequestException('Question already answered'));

      expect(responsesFor(ACTIVE)).toEqual([
        expect.objectContaining({ questionId: 202, rankChoiceId: 5 }),
      ]);
    });
  });

  describe('deterministic ordering and resume', () => {
    it('serves questions by question_order, the same on every request', async () => {
      const first = await service.getNextQuestion(
        ACTIVE,
        'HEAD',
        OWNER,
        'USER',
      );
      const again = await service.getNextQuestion(
        ACTIVE,
        'HEAD',
        OWNER,
        'USER',
      );

      expect('question' in first && first.question.id).toBe(202);
      expect('question' in again && again.question.id).toBe(202);

      const served: number[] = [];
      for (;;) {
        const next = await service.getNextQuestion(
          ACTIVE,
          'HEAD',
          OWNER,
          'USER',
        );
        if ('completed' in next) break;
        served.push(next.question.id);
        await service.submitAnswer(
          ACTIVE,
          'HEAD',
          next.question.id,
          3,
          OWNER,
          'USER',
        );
      }

      expect(served).toEqual([202, 203, 201]);
    });

    it('resumes an unfinished center from the next unanswered question', async () => {
      await service.submitAnswer(ACTIVE, 'HEAD', 202, 3, OWNER, 'USER');

      const resumed = await service.getNextQuestion(
        ACTIVE,
        'HEAD',
        OWNER,
        'USER',
      );

      expect('question' in resumed && resumed.question.id).toBe(203);
      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(1);
    });
  });

  describe('duplicate attempts', () => {
    it('reuses existing center sessions when start is called again', async () => {
      await service.startPersonality(ACTIVE, OWNER, 'USER');
      const result = await service.startPersonality(ACTIVE, OWNER, 'USER');

      expect(result).toEqual({ started: true, centers: ['HEAD', 'GUT'] });
      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(2);
    });

    it('creates one center session when start requests overlap', async () => {
      const [a, b] = await Promise.all([
        service.startPersonality(ACTIVE, OWNER, 'USER'),
        service.startPersonality(ACTIVE, OWNER, 'USER'),
      ]);

      expect(a).toEqual(b);
      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(2);
    });

    it('creates one center session when first-question requests overlap', async () => {
      await Promise.all([
        service.getNextQuestion(ACTIVE, 'HEAD', OWNER, 'USER'),
        service.getNextQuestion(ACTIVE, 'HEAD', OWNER, 'USER'),
      ]);

      expect(db.snapshot(ACTIVE).personalitySessions).toHaveLength(1);
    });
  });

  describe('existing access rules', () => {
    it('still blocks a user without the Stage 2 grant', async () => {
      await expect(
        service.startPersonality(NO_GRANT, NO_GRANT_OWNER, 'USER'),
      ).rejects.toThrow(new UnauthorizedException('AUTH_REQUIRED'));
      await expect(
        service.getNextQuestion(NO_GRANT, 'GUT', NO_GRANT_OWNER, 'USER'),
      ).rejects.toThrow(new ForbiddenException('AUTH_REQUIRED'));
      expect(db.snapshot(NO_GRANT).personalitySessions).toHaveLength(0);
    });

    it('still blocks disabled and unverified owners, including for admins', async () => {
      const owner = db.table(User).find((u) => u.id === OWNER)!;

      owner.accountEnabled = false;
      await expect(
        service.canAccessStage2(ACTIVE, ADMIN, 'ADMIN'),
      ).resolves.toEqual({
        allowed: false,
        reason: 'ACCOUNT_DISABLED',
      });

      owner.accountEnabled = true;
      owner.emailVerified = false;
      await expect(
        service.canAccessStage2(ACTIVE, OWNER, 'USER'),
      ).resolves.toEqual({
        allowed: false,
        reason: 'EMAIL_NOT_VERIFIED',
      });
    });

    it('still lets an admin bypass only the Stage 2 grant', async () => {
      await expect(
        service.canAccessStage2(NO_GRANT, ADMIN, 'ADMIN'),
      ).resolves.toEqual({
        allowed: true,
      });
    });

    it('still rejects another user acting on a session they do not own', async () => {
      await expect(
        service.getNextQuestion(ACTIVE, 'HEAD', NO_GRANT_OWNER, 'USER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
