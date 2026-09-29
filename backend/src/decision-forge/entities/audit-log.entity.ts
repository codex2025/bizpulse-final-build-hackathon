import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('decision_audit_logs')
export class DecisionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type' })
  eventType: string; // DECISION_GENERATED | ACTION_APPROVED | ACTION_MODIFIED | ACTION_REJECTED | SIMULATION_RUN | CLIENT_CONVERTED

  @Column({ name: 'decision_run_id', nullable: true })
  decisionRunId: string;

  @Column({ name: 'opportunity_id', nullable: true })
  opportunityId: string;

  @Column({ name: 'company_name', nullable: true })
  companyName: string;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string;

  @Column({ name: 'actor_email', nullable: true })
  actorEmail: string;

  @Column({ type: 'simple-json', nullable: true })
  payload: any;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
