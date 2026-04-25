import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { GroupMemberRole } from '@finance/common';

import { AppUser } from '../user/user.entity';
import { FinanceGroup } from './finance-group.entity';

@Entity({ name: 'group_member' })
@Index('ix_member_user', ['userId'])
export class GroupMember {
  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => FinanceGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: FinanceGroup;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: AppUser;

  @Column({ type: 'enum', enum: GroupMemberRole, enumName: 'group_member_role' })
  role!: GroupMemberRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;
}
