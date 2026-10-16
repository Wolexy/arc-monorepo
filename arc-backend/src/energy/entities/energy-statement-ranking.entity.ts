import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'energy_statement_rankings' })
export class EnergyStatementRanking {
  @PrimaryColumn({ name: 'group_response_id' })
  groupResponseId!: number;

  @PrimaryColumn({ name: 'statement_id' })
  statementId!: number;

  @Column({ name: 'rank_id' })
  rankId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
