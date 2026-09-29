import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('wealth_items')
export class WealthItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  name: string;

  @Column()
  type: string; // 'asset' | 'liability'

  @Column()
  category: string;
  // Asset: 'cash' | 'bank' | 'stocks' | 'mutual_funds' | 'gold' | 'real_estate' | 'fd' | 'pf' | 'other'
  // Liability: 'home_loan' | 'personal_loan' | 'credit_card' | 'vehicle_loan' | 'other'

  @Column({ type: 'float' })
  value: number;

  @Column({ nullable: true })
  institution: string; // Bank name, broker, etc.

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  as_of_date: string; // ISO date

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
