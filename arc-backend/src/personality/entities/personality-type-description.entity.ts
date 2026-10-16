import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('personality_type_descriptions')
export class PersonalityTypeDescription {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'personality_type_id' })
  personalityTypeId!: number;

  @Column()
  title!: string;

  @Column()
  overview!: string;

  @Column()
  strengths!: string;

  @Column()
  weaknesses!: string;

  @Column({ name: 'growth_path' })
  growthPath!: string;

  @Column({ nullable: true })
  note?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
