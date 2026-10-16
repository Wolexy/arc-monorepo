import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'energy_statement_groups' })
export class EnergyStatementGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Column({ name: 'stage_id' })
  stageId!: number;

  @Column({ name: 'group_no' })
  groupNo!: number;
}
