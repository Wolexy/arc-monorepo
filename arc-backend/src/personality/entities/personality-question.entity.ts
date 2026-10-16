// src/personality/entities/personality-question.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('personality_questions')
export class PersonalityQuestion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'energy_center', type: 'varchar', length: 10 })
  energyCenter!: 'GUT' | 'HEAD' | 'HEART'; // 1..3

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'question_order', type: 'int' })
  questionOrder!: number; // 1..45

  @Column({ name: 'personality_type_id', type: 'int' })
  personalityTypeId!: number;
}
