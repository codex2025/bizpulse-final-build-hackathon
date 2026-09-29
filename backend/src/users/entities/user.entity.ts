import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  business_name: string;

  @Column({ nullable: true })
  gst_number: string;

  @Column({ default: 'business' })
  persona_type: string; // 'business' | 'self_employed' | 'employee'

  @Column({ nullable: true })
  job_title: string;

  @Column({ type: 'float', default: 0 })
  monthly_income: number;

  @Column({ type: 'float', default: 0 })
  monthly_expense: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

