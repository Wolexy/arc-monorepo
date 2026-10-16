import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('final_personality_results')
export class FinalPersonalityResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'test_session_id' })
  testSessionId!: string;

  @Column({ name: 'personality_type_id' })
  personalityTypeId!: number;

  @Column({ name: 'total_score' })
  totalScore!: number;

  @Column({ name: 'is_dominant', default: false })
  isDominant!: boolean;

  @Column({
    name: 'calculated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  calculatedAt!: Date;
}
