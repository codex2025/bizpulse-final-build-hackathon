import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true, default: '🎯' })
  icon: string;

  @Column({ nullable: true, default: 'brand' })
  color: string; // 'brand' | 'emerald' | 'amber' | 'purple' | 'blue'

  @Column({ type: 'float' })
  target_amount: number;

  @Column({ type: 'float', default: 0 })
  current_amount: number;

  @Column({ type: 'text', nullable: true })
  deadline: string; // ISO date string e.g. "2027-03-01"

  @Column({ default: 'active' })
  status: string; // 'active' | 'completed' | 'paused'

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
