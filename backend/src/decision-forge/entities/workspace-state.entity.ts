import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * What the gateway must remember so ANY ai-service instance can rebuild a user's workspace after a
 * cold start or restart: which dataset the user chose, the uploaded records (custom datasets only)
 * and which opportunities had external context fetched. Everything else (scores, RAG index, quality
 * report) is recomputed deterministically from these inputs.
 */
@Entity('decision_workspace_states')
export class DecisionWorkspaceState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  /** real | synthetic | legacy | custom */
  @Column({ name: 'dataset_key' })
  datasetKey: string;

  @Column({ name: 'snapshot_id', nullable: true })
  snapshotId: string;

  /** Opaque fingerprint of the ai-service state this row describes; sent as X-Workspace-State. */
  @Column({ name: 'state_fingerprint' })
  stateFingerprint: string;

  /** Normalized uploaded records; null for the deterministic preset datasets. */
  @Column({ type: 'simple-json', nullable: true })
  records: any[] | null;

  @Column({ name: 'fetched_opportunity_ids', type: 'simple-json', nullable: true })
  fetchedOpportunityIds: string[] | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
