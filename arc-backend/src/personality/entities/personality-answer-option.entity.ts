// src/personality/entities/personality-answer-option.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('personality_answer_options')
@Index(['questionId', 'score'], { unique: true })
export class PersonalityAnswerOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'question_id', type: 'int' })
  questionId!: number;

  @Column({ type: 'varchar', length: 50 })
  text!: string; // VERY TRUE, TRUE, etc.

  @Column({ type: 'int' })
  score!: number; // 5..1

  @Column({ name: 'personality_type_id', type: 'int' })
  personalityTypeId!: number;
  // Type One..Nine (admin clarity)
}
