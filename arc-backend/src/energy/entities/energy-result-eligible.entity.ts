import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'energy_result_eligible_centers' })
export class EnergyResultEligibleCenter {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'energy_center' })
  energyCenter!: string; // GUT | HEART | HEAD

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
