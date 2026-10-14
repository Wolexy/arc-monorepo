import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { OneToMany } from 'typeorm';

import { TestSession } from '../../sessions/entities/test-session.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'email', unique: true })
  email!: string;

  @Column({ name: 'password', type: 'text' })
  passwordHash!: string;

  @Column({ default: 'USER' })
  role!: 'USER' | 'ADMIN';

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'access_granted', default: false })
  accessGranted!: boolean;

  @Column({
    name: 'account_enabled',
    type: 'boolean',
    default: true,
  })
  accountEnabled!: boolean;

  @Column({
    name: 'stage2_access_granted',
    type: 'boolean',
    default: false,
  })
  stage2AccessGranted!: boolean;

  @Column({ name: 'access_granted_at', type: 'timestamptz', nullable: true })
  accessGrantedAt!: Date |null;

  @Column({ name: 'access_granted_by', nullable: true })
  accessGrantedBy!: number |null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'email_verification_token', nullable: true, type: 'varchar' })
  emailVerificationToken!: string | null;

  @Column({
    name: 'email_verification_expires',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpires!: Date | null;

  @OneToMany(
    () => TestSession,

    (session) => session.user,
  )
  testSessions!: TestSession[];
}
