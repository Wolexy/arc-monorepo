import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('personality_rank_choices')
export class PersonalityRankChoice {
  @PrimaryColumn()
  id!: number;

  @Column()
  label!: string;

  @Column()
  score!: number;
}
