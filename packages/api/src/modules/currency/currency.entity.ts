import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'currency' })
export class Currency {
  @PrimaryColumn({ type: 'char', length: 3 })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  symbol!: string;

  @Column({ name: 'decimal_places', type: 'smallint' })
  decimalPlaces!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
