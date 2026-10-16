import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'energy_results' })
export class EnergyResult {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'gut_score', type: 'int' })
  gutScore!: number;

  @Column({ name: 'heart_score' })
  heartScore!: number;

  @Column({ name: 'head_score', type: 'int' })
  headScore!: number;

  @Column({
    name: 'dominant_center',
    type: 'varchar',
    nullable: true,
    length: 10,
  })
  dominantCenter?: string | null;

  @CreateDateColumn({
    name: 'calculated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  calculatedAt!: Date;
}
