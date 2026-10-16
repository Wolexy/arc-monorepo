// src/personality/entities/personality-result.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('personality_results')
export class PersonalityResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'personality_session_id' })
  personalitySessionId!: number;

  @Column({ name: 'energy_center', length: 10 })
  energyCenter!: string; // GUT | HEART | HEAD

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt!: Date;
}
