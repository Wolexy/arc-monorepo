import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'personality_sessions' })
export class PersonalitySession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'test_session_id', type: 'uuid' })
  testSessionId!: string;

  @Column({ name: 'energy_center', type: 'varchar' })
  energyCenter!: string; // GUT | HEART | HEAD

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
