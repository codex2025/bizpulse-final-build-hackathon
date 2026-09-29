import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('decision_policy_configs')
export class DecisionPolicyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'deal_value_weight', type: 'float', default: 0.25 })
  dealValueWeight: number;

  @Column({ name: 'win_probability_weight', type: 'float', default: 0.20 })
  winProbabilityWeight: number;

  @Column({ name: 'engagement_weight', type: 'float', default: 0.20 })
  engagementWeight: number;

  @Column({ name: 'recency_weight', type: 'float', default: 0.15 })
  recencyWeight: number;

  @Column({ name: 'intent_external_weight', type: 'float', default: 0.20 })
  intentExternalWeight: number;

  @Column({ name: 'high_priority_threshold', type: 'float', default: 75.0 })
  highPriorityThreshold: number;

  @Column({ name: 'medium_priority_threshold', type: 'float', default: 55.0 })
  mediumPriorityThreshold: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
