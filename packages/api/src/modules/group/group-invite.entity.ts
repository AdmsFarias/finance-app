import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GroupMemberRole } from '@finance/common';

import { AppUser } from '../user/user.entity';
import { FinanceGroup } from './finance-group.entity';

@Entity({ name: 'group_invite' })
export class GroupInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => FinanceGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: FinanceGroup;

  @Column({ type: 'citext' })
  email!: string;

  @Column({
    type: 'enum',
    enum: GroupMemberRole,
    enumName: 'group_member_role',
    default: GroupMemberRole.MEMBER,
  })
  role!: GroupMemberRole;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy!: string;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'invited_by' })
  inviter!: AppUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
