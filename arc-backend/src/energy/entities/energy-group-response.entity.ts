import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'energy_group_responses' })
export class EnergyGroupResponse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'energy_statement_group_id' })
  energyStatementGroupId!: number;

  @Column({ name: 'submitted_at' })
  submittedAt!: Date;
}
