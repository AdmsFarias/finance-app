import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AppUser } from '../user/user.entity';

import { FixedExpense } from './fixed-expense.entity';

@Entity({ name: 'fixed_expense_check' })
export class FixedExpenseCheck {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fixed_expense_id', type: 'uuid' })
  fixedExpenseId!: string;

  @ManyToOne(() => FixedExpense, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fixed_expense_id' })
  fixedExpense!: FixedExpense;

  @Column({ name: 'year_month', type: 'char', length: 7 })
  yearMonth!: string;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt!: Date;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 20, scale: 2, nullable: true })
  paidAmount!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'created_by' })
  creator!: AppUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
