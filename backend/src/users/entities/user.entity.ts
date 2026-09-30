import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Always stored lowercase; looked up case-insensitively. */
  @Column({ unique: true })
  email: string;

  /**
   * bcrypt hash. For an account that signs in with Google this holds the hash of a random value nobody knows, so a
   * password sign-in can never succeed for it (the column stays non-null so no schema change is needed).
   */
  @Column()
  password: string;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  business_name: string;

  @Column({ nullable: true })
  gst_number: string;

  @Column({ default: 'business' })
  persona_type: string; // 'business' | 'self_employed' | 'personal' | 'employee'

  @Column({ nullable: true })
  job_title: string;

  @Column({ type: 'float', default: 0 })
  monthly_income: number;

  @Column({ type: 'float', default: 0 })
  monthly_expense: number;

  /** The Firebase user id (`sub` of a verified ID token) once a Google identity is linked. Never set from a request body. */
  @Column({ type: 'varchar', unique: true, nullable: true })
  firebase_uid: string | null;

  /** How the account signs in: 'password' (email + password) or 'google'. */
  @Column({ default: 'password' })
  auth_provider: string;

  /** True only when the email was verified by an identity provider (a Google account). */
  @Column({ default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
