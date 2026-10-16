// src/personality/entities/personality-response.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('personality_responses')
@Index(['personalitySessionId', 'questionId'], { unique: true })
export class PersonalityResponse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'personality_session_id', type: 'int' })
  personalitySessionId!: number;

  @Column({ name: 'question_id', type: 'int' })
  questionId!: number;

  @Column({ name: 'rank_choice_id', type: 'int' })
  rankChoiceId!: number;

  @CreateDateColumn({ name: 'answered_at' })
  answeredAt!: Date;
}
