import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import {
  CreateGroupInput,
  ErrorCode,
  GroupDto,
  GroupMemberRole,
  GroupSummaryDto,
  UpdateGroupInput,
} from '@finance/common';

import { FinanceGroup } from './finance-group.entity';
import { GroupMember } from './group-member.entity';

function mapGroup(group: FinanceGroup): GroupDto {
  return {
    id: group.id,
    name: group.name,
    baseCurrency: group.baseCurrency,
    createdAt: group.createdAt.toISOString(),
    archivedAt: group.archivedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class GroupService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FinanceGroup) private readonly groups: Repository<FinanceGroup>,
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
  ) {}

  async listForUser(userId: string): Promise<GroupSummaryDto[]> {
    const rows = await this.members.find({
      where: { userId },
      relations: { group: true },
    });
    return rows
      .filter((m) => !m.group.archivedAt)
      .map((m) => ({
        id: m.group.id,
        name: m.group.name,
        baseCurrency: m.group.baseCurrency,
        role: m.role,
      }));
  }

  async getById(groupId: string): Promise<GroupDto> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Group not found' });
    }
    return mapGroup(group);
  }

  async create(creatorId: string, input: CreateGroupInput): Promise<GroupDto> {
    const group = await this.dataSource.transaction(async (trx) => {
      const entity = trx.getRepository(FinanceGroup).create({
        name: input.name.trim(),
        baseCurrency: input.baseCurrency,
        createdBy: creatorId,
      });
      const saved = await trx.getRepository(FinanceGroup).save(entity);

      const membership = trx.getRepository(GroupMember).create({
        groupId: saved.id,
        userId: creatorId,
        role: GroupMemberRole.OWNER,
      });
      await trx.getRepository(GroupMember).save(membership);
      return saved;
    });
    return mapGroup(group);
  }

  async update(groupId: string, input: UpdateGroupInput): Promise<GroupDto> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Group not found' });
    }
    if (input.name !== undefined) group.name = input.name.trim();
    if (input.baseCurrency !== undefined) group.baseCurrency = input.baseCurrency;
    const saved = await this.groups.save(group);
    return mapGroup(saved);
  }

  async archive(groupId: string, userId: string): Promise<void> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Group not found' });
    }
    if (group.archivedAt) return;

    // Avoid archiving the user's last active group (they must always have at least 1)
    const activeMemberships = await this.members.find({
      where: { userId },
      relations: { group: true },
    });
    const activeCount = activeMemberships.filter(
      (m) => !m.group.archivedAt && m.groupId !== groupId,
    ).length;
    if (activeCount === 0) {
      throw new ConflictException({
        code: 'LAST_GROUP',
        message: 'Cannot archive your last active group',
      });
    }

    group.archivedAt = new Date();
    await this.groups.save(group);
  }

  async countOwners(groupId: string): Promise<number> {
    return this.members.count({
      where: { groupId, role: GroupMemberRole.OWNER },
    });
  }

  async assertGroupExists(groupId: string): Promise<FinanceGroup> {
    const group = await this.groups.findOne({ where: { id: groupId, archivedAt: IsNull() } });
    if (!group) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Group not found or archived',
      });
    }
    return group;
  }
}
