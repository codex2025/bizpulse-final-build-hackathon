import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'text' })
  expense_date: string;

  @Column({ nullable: true })
  receipt_url: string;

  @CreateDateColumn()
  created_at: Date;
}
