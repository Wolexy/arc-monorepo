import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'energy_statements' })
export class EnergyStatement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id' })
  groupId!: number;

  @Column({ name: 'personality_type' })
  personalityType!: string; // GUT | HEART | HEAD

  @Column()
  text!: string;
}
