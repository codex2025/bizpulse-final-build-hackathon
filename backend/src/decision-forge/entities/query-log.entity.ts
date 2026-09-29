import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** One natural-language question and everything the system did to answer it (for replay). */
@Entity('decision_query_logs')
export class DecisionQueryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'decision_run_id', nullable: true })
  decisionRunId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'simple-json', nullable: true })
  plan: any;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ type: 'simple-json', nullable: true })
  analytics: any;

  @Column({ type: 'simple-json', nullable: true })
  rag: any;

  @Column({ type: 'simple-json', nullable: true })
  trace: any;

  @Column({ name: 'policy_version', nullable: true })
  policyVersion: string;

  @Column({ name: 'snapshot_id', nullable: true })
  snapshotId: string;

  @Column({ name: 'dataset_key', nullable: true })
  datasetKey: string;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
