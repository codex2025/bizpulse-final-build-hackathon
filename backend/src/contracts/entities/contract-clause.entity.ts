import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ContractAnalysis } from './contract-analysis.entity';

@Entity('contract_clauses')
export class ContractClause {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contract_id: string;

  @ManyToOne(() => ContractAnalysis, (analysis) => analysis.contract_clauses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: ContractAnalysis;

  @Column()
  clause_type: string;

  @Column({ type: 'text', nullable: true })
  original_text: string;

  @Column({ type: 'text', nullable: true })
  plain_explanation: string;

  @Column({ default: 'Low' })
  risk_level: string;

  @Column({ default: 'high' })
  confidence: string;

  @Column({ type: 'text', nullable: true })
  confidence_reason: string;

  @Column({ type: 'simple-json', nullable: true })
  source_chunk_ids: string[];

  @Column({ type: 'int', default: 1 })
  source_page: number;

  @Column({ type: 'simple-json', nullable: true })
  financial_values: any;
}
