import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ContractAnalysis } from './contract-analysis.entity';

@Entity('contract_queries')
export class ContractQuery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contract_id: string;

  @ManyToOne(() => ContractAnalysis, (analysis) => analysis.contract_queries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: ContractAnalysis;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'simple-json', nullable: true })
  cited_clauses: any[];

  @Column({ default: 'high' })
  confidence: string;

  @CreateDateColumn()
  created_at: Date;
}
