import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { FxRateSource } from '@finance/common';

@Entity({ name: 'fx_rate' })
export class FxRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: FxRateSource,
    enumName: 'fx_rate_source',
    default: FxRateSource.PROVIDER,
  })
  source!: FxRateSource;

  @Column({ name: 'from_code', type: 'char', length: 3 })
  from!: string;

  @Column({ name: 'to_code', type: 'char', length: 3 })
  to!: string;

  @Column({ name: 'rate_date', type: 'date' })
  rateDate!: string;

  @Column({ type: 'numeric', precision: 20, scale: 10 })
  rate!: string;

  @CreateDateColumn({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;
}
