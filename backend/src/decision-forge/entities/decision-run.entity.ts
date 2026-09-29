import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('decision_runs')
export class DecisionRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'decision_run_id', unique: true })
  decisionRunId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'policy_version', default: 'v2.4-deterministic' })
  policyVersion: string;

  @Column({ name: 'records_analyzed', type: 'integer', default: 0 })
  recordsAnalyzed: number;

  @Column({ name: 'pipeline_total_value', type: 'float', default: 0.0 })
  pipelineTotalValue: number;

  @Column({ name: 'weighted_pipeline_value', type: 'float', default: 0.0 })
  weightedPipelineValue: number;

  @Column({ name: 'high_priority_count', type: 'integer', default: 0 })
  highPriorityCount: number;

  @Column({ name: 'stale_warning_count', type: 'integer', default: 0 })
  staleWarningCount: number;

  @Column({ type: 'simple-json', nullable: true })
  recommendations: any[];

  /** The exact policy body used (weights, thresholds, penalties) so the run can be replayed. */
  @Column({ name: 'policy_snapshot', type: 'simple-json', nullable: true })
  policySnapshot: any;

  /** Hash of the input records the run was computed from. */
  @Column({ name: 'snapshot_id', nullable: true })
  snapshotId: string;

  @Column({ name: 'dataset_key', nullable: true })
  datasetKey: string;

  @Column({ name: 'data_snapshot', nullable: true })
  dataSnapshot: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
