import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity({ name: 'test_sessions' })
export class TestSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId?: number | null;

  //This userEmail is marked for deletion later
  @Column({ name: 'user_email', type: 'text', nullable: true })
  userEmail?: string | null;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'stage1_completed_at', type: 'timestamp', nullable: true })
  stage1CompletedAt?: Date | null;

  @Column({ name: 'stage2_unlocked_at', type: 'timestamp', nullable: true })
  stage2UnlockedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  //user: User;

  @ManyToOne(() => User, (user) => user.testSessions, {
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
