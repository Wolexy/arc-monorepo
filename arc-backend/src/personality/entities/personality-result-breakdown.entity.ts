import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('personality_result_breakdowns')
export class PersonalityResultBreakdown {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'personality_session_id', type: 'int' })
  personalitySessionId!: number;

  @Column({ name: 'personality_type_id', type: 'int' })
  personalityTypeId!: number;

  @Column({ type: 'int' })
  score!: number;
}
