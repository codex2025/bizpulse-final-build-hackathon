import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ContractClause } from './contract-clause.entity';
import { ContractQuery } from './contract-query.entity';

@Entity('contract_analyses')
export class ContractAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  document_name: string;

  @Column({ default: 'pending' })
  analysis_status: string;

  @Column({ nullable: true })
  chroma_collection_id: string;

  @Column({ type: 'int', default: 0 })
  total_chunks: number;

  @Column({ type: 'simple-json', nullable: true })
  clauses: any;

  @Column({ type: 'simple-json', nullable: true })
  executive_summary: string[];

  @Column({ type: 'simple-json', nullable: true })
  red_flags: string[];

  @Column({ type: 'simple-json', nullable: true })
  borrower_rights: string[];

  @Column({ type: 'simple-json', nullable: true })
  simulation_results: any;

  @Column({ type: 'simple-json', nullable: true })
  negotiation_tips: any;

  @Column({ type: 'simple-json', nullable: true })
  decision: any;

  @Column({ type: 'simple-json', nullable: true })
  ledger_impact: any;



  @OneToMany(() => ContractClause, (clause) => clause.contract, { cascade: true })
  contract_clauses: ContractClause[];

  @OneToMany(() => ContractQuery, (query) => query.contract, { cascade: true })
  contract_queries: ContractQuery[];

  @CreateDateColumn()
  created_at: Date;
}
