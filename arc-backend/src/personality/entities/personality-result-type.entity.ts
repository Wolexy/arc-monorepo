// src/personality/entities/personality-result-type.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('personality_result_types')
export class PersonalityResultType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'personality_result_id' })
  personalityResultId!: number;

  @Column({ name: 'personality_type_id' })
  personalityTypeId!: number; // 1–9

  @Column()
  score!: number;

  @Column()
  rank!: number; // 1 or 2
}
