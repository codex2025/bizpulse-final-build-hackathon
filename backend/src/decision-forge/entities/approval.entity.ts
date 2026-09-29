import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';

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

  @Column({
    type: 'varchar',
    default: 'PENDING',
  })
  status: ApprovalStatus;

  @Column({ name: 'approved_action', nullable: true })
  approvedAction: string;

  @Column({ name: 'reviewer_notes', nullable: true })
  reviewerNotes: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'converted_client_id', nullable: true })
  convertedClientId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
