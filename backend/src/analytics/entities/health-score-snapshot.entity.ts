import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('health_score_snapshots')
export class HealthScoreSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  month: string; // e.g. "2026-08"

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'simple-json', nullable: true })
  breakdown: {
    p1: number;
    p2: number;
    p3: number;
    p4: number;
    p5: number;
    statusLabel: string;
    savingsRate: number;
  };

  @CreateDateColumn()
  created_at: Date;
}
