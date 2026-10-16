import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('assessment_stages')
export class AssessmentStage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'assessment_id', type: 'int' })
  assessmentId!: number;

  @Column({ name: 'stage_order', type: 'int' })
  stageOrder!: number;

  @Column({ name: 'energy_center_id', type: 'int', nullable: true })
  energyCenterId?: number | null;

  @Column({ name: 'requires_auth', type: 'boolean', default: false })
  requiresAuth!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
