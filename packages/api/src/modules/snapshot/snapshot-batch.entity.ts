import { SnapshotSource } from '@finance/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FinanceGroup } from '../group/finance-group.entity';
import { AppUser } from '../user/user.entity';

@Entity({ name: 'snapshot_batch' })
export class SnapshotBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => FinanceGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: FinanceGroup;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate!: string;

  @Column({ type: 'enum', enum: SnapshotSource, enumName: 'snapshot_source' })
  source!: SnapshotSource;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'base_currency', type: 'char', length: 3 })
  baseCurrency!: string;

  @Column({ name: 'total_base', type: 'numeric', precision: 20, scale: 2, default: 0 })
  totalBase!: string;

  @Column({ name: 'entry_count', type: 'int', default: 0 })
  entryCount!: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'created_by' })
  creator!: AppUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
