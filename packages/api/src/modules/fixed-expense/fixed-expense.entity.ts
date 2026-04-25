import { RecurrenceFreq } from '@finance/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FinanceGroup } from '../group/finance-group.entity';

@Entity({ name: 'fixed_expense' })
export class FixedExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => FinanceGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: FinanceGroup;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'day_of_month', type: 'int' })
  dayOfMonth!: number;

  @Column({ type: 'enum', enum: RecurrenceFreq, enumName: 'recurrence_freq' })
  recurrence!: RecurrenceFreq;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
