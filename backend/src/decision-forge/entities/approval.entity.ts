import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * DRAFT    recommendation exists, nobody has looked at it
 * REVIEW   a human has opened it for review
 * APPROVED / REJECTED  terminal
 * MODIFIED the reviewer changed the action; may still be approved or rejected afterwards
 */
export type ApprovalStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'MODIFIED'
  | 'REJECTED'
  | 'PENDING';

@Entity('decision_approvals')
export class DecisionApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recommendation_id' })
  recommendationId: string;

  @Column({ name: 'decision_run_id', nullable: true })
  decisionRunId: string;

  @Column({ name: 'opportunity_id' })
  opportunityId: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'deal_value', type: 'float', default: 0.0 })
  dealValue: number;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: ApprovalStatus;

  @Column({ name: 'approved_action', nullable: true })
  approvedAction: string;

  @Column({ name: 'reviewer_notes', nullable: true })
  reviewerNotes: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'converted_client_id', nullable: true })
  convertedClientId: string;

  /** Frozen copy of what the reviewer saw: score, factors, evidence pack, warnings. */
  @Column({ name: 'evidence_snapshot', type: 'simple-json', nullable: true })
  evidenceSnapshot: any;

  @Column({ name: 'policy_version', nullable: true })
  policyVersion: string;

  @Column({ name: 'snapshot_id', nullable: true })
  snapshotId: string;

  @Column({ name: 'priority_score', type: 'float', nullable: true })
  priorityScore: number;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  /** [{from, to, at, by}] every state transition. */
  @Column({ name: 'status_history', type: 'simple-json', nullable: true })
  statusHistory: any[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
