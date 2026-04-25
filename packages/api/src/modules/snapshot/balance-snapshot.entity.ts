import { FxRateSource, WalletType } from '@finance/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Wallet } from '../wallet/wallet.entity';

import { SnapshotBatch } from './snapshot-batch.entity';

@Entity({ name: 'balance_snapshot' })
export class BalanceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @ManyToOne(() => SnapshotBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch!: SnapshotBatch;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ name: 'wallet_name', type: 'text' })
  walletName!: string;

  @Column({ name: 'wallet_type', type: 'enum', enum: WalletType, enumName: 'wallet_type' })
  walletType!: WalletType;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount!: string;

  @Column({ name: 'amount_base', type: 'numeric', precision: 20, scale: 2 })
  amountBase!: string;

  @Column({ name: 'fx_rate', type: 'numeric', precision: 20, scale: 10 })
  fxRate!: string;

  @Column({ name: 'fx_rate_date', type: 'date' })
  fxRateDate!: string;

  @Column({ name: 'fx_source', type: 'enum', enum: FxRateSource, enumName: 'fx_rate_source' })
  fxSource!: FxRateSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
